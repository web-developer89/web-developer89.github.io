import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'src/config/youtube.json');
const overlayPath = path.join(root, 'src/content/overlay.json');
const catalogPath = path.join(root, 'src/data/catalog.json');
const feedPath = path.join(root, 'src/data/feed.json');
const publicData = path.join(root, 'public/data');
const mediaDir = path.join(root, 'public/media');
const brandDir = path.join(root, 'public/brand');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  textNodeName: '#text',
});

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function text(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') {
    if (typeof value['#text'] === 'string') return value['#text'].trim();
  }
  return '';
}

function slugify(title, id) {
  const base = title
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/g, '');
  return `${base || 'video'}-${id}`;
}

function excerpt(description) {
  const lines = description.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const editorial = [];
  for (const line of lines) {
    if (/^https?:\/\//i.test(line)) break;
    if (/amazon|tesla|iban|whatsapp|telegram|^x:\s|werbung|affiliate|unterstützung per spende/i.test(line)) break;
    if (line.startsWith('#')) continue;
    editorial.push(line);
  }
  const value = editorial.join(' ').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  if (value.length <= 180) return value;
  return `${value.slice(0, 177).replace(/\s+\S*$/, '')}…`;
}

function tagsOf(description) {
  const found = [...description.matchAll(/#([\p{L}\p{N}_]+)/gu)].map((match) => match[1]);
  return [...new Set(found)];
}

function formatDuration(iso) {
  if (!iso) return null;
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return null;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  const ss = String(seconds).padStart(2, '0');
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

function remoteThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function writeJson(file, data) {
  const tmp = `${file}.tmp`;
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

async function fetchThumb(id) {
  const candidates = [
    `https://i.ytimg.com/vi/${id}/hq720.jpg`,
    `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ];
  for (const url of candidates) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) continue;
      const type = response.headers.get('content-type') || '';
      if (!type.includes('image')) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.length < 3000) continue;
      return buffer;
    } catch {
      continue;
    }
  }
  return null;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current], current);
    }
  }
  const size = Math.min(limit, items.length);
  if (size > 0) await Promise.all(Array.from({ length: size }, worker));
  return results;
}

function toVideo(raw, channel) {
  const description = raw.description || '';
  const editorial = excerpt(description);
  return {
    id: raw.id,
    slug: slugify(raw.title, raw.id),
    channelId: channel.channelId,
    channelName: channel.name,
    title: raw.title,
    description,
    excerpt: editorial || raw.title,
    publishedAt: raw.publishedAt,
    url: `https://www.youtube.com/watch?v=${raw.id}`,
    thumbnail: `/media/${raw.id}.jpg`,
    thumbnailRemote: raw.thumbnailRemote || remoteThumb(raw.id),
    durationLabel: raw.durationLabel || null,
    tags: tagsOf(description),
  };
}

async function fetchRss(channel) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`,
    {
      headers: { 'user-agent': 'PolitikMitKopf/1.0' },
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok) throw new Error(`RSS ${response.status}`);
  const xml = await response.text();
  const feed = parser.parse(xml);
  const entries = asArray(feed?.feed?.entry);
  if (!entries.length) throw new Error('RSS ohne Einträge');
  return entries.map((entry) => {
    const id = text(entry.videoId);
    const group = entry.group || {};
    return {
      id,
      title: text(entry.title) || text(group.title),
      description: text(group.description),
      publishedAt: text(entry.published),
      thumbnailRemote: group.thumbnail?.['@_url'] || remoteThumb(id),
      durationLabel: null,
    };
  }).filter((item) => item.id && item.title);
}

async function fetchApi(channel, apiKey, maxVideos) {
  const playlistId = `UU${channel.channelId.slice(2)}`;
  const collected = [];
  let pageToken = '';
  while (collected.length < maxVideos) {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.searchParams.set('part', 'snippet,contentDetails');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('key', apiKey);
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`YouTube API ${response.status}`);
    const data = await response.json();
    for (const item of data.items || []) {
      const id = item.contentDetails?.videoId;
      const snippet = item.snippet || {};
      if (!id || snippet.title === 'Deleted video' || snippet.title === 'Private video') continue;
      const thumbs = snippet.thumbnails || {};
      collected.push({
        id,
        title: snippet.title || '',
        description: snippet.description || '',
        publishedAt: snippet.publishedAt || item.contentDetails?.videoPublishedAt || '',
        thumbnailRemote: thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || remoteThumb(id),
        durationLabel: null,
        liveBroadcastContent: snippet.liveBroadcastContent || 'none',
      });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const details = new Map();
  for (let offset = 0; offset < collected.length; offset += 50) {
    const ids = collected.slice(offset, offset + 50).map((item) => item.id).join(',');
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails,snippet');
    url.searchParams.set('id', ids);
    url.searchParams.set('key', apiKey);
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) continue;
    const data = await response.json();
    for (const item of data.items || []) {
      details.set(item.id, item);
    }
  }

  let live = null;
  const videos = collected.slice(0, maxVideos).map((item) => {
    const detail = details.get(item.id);
    const liveState = detail?.snippet?.liveBroadcastContent || item.liveBroadcastContent;
    item.durationLabel = formatDuration(detail?.contentDetails?.duration);
    if (!live && liveState === 'live') {
      live = {
        videoId: item.id,
        title: item.title,
        channelId: channel.channelId,
        channelName: channel.name,
        url: `https://www.youtube.com/watch?v=${item.id}`,
        thumbnail: `/media/${item.id}.jpg`,
        thumbnailRemote: item.thumbnailRemote,
      };
    }
    return item;
  });
  return { videos, live };
}

async function detectLive(channel) {
  const response = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20250925.01.00',
          hl: 'de',
          gl: 'DE',
        },
      },
      browseId: channel.channelId,
      params: 'EgRsaXZluAEAkgMA8gYECgJ6AA%3D%3D',
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) return null;
  const body = await response.text();
  if (!body.includes('BADGE_STYLE_TYPE_LIVE_NOW')) return null;
  const videoId = body.match(/"videoId":"([a-zA-Z0-9_-]{11})"/)?.[1];
  if (!videoId) return null;
  const encoded = body.match(/"title":\{"runs":\[\{"text":"((?:\\.|[^"\\])*)"/)?.[1];
  let title = 'Livestream';
  if (encoded) {
    try {
      title = JSON.parse(`"${encoded}"`);
    } catch {
      title = encoded;
    }
  }
  return {
    videoId,
    title,
    channelId: channel.channelId,
    channelName: channel.name,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    thumbnail: `/media/${videoId}.jpg`,
    thumbnailRemote: remoteThumb(videoId),
  };
}

async function saveImage(file, buffer) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
}

async function downloadAvatar(channel) {
  if (!channel.avatarUrl) return;
  try {
    const response = await fetch(channel.avatarUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 500) return;
    const target = channel.featured ? path.join(brandDir, 'mark.jpg') : path.join(brandDir, `${channel.channelId}.jpg`);
    await saveImage(target, buffer);
  } catch {
    console.error(`Avatar nicht geladen: ${channel.name}`);
  }
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const previous = await readJson(catalogPath, { videos: [], channels: [], live: null });
  const overlay = await readJson(overlayPath, { headline: '', ticker: '', custom: '' });
  const apiKey = process.env.YOUTUBE_API_KEY?.trim() || '';
  const overrideId = process.env.YOUTUBE_CHANNEL_ID?.trim() || '';

  const channels = config.channels.map((channel) => ({ ...channel }));
  if (overrideId) {
    const featured = channels.find((channel) => channel.featured) || channels[0];
    if (featured) featured.channelId = overrideId;
  }

  const videos = [];
  const channelStats = [];
  let live = null;
  let usedApi = false;
  let usedRss = false;
  let failed = 0;

  for (const channel of channels.sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!channel.enabled) {
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: 0,
        status: 'deaktiviert',
        avatar: channel.avatar || '/brand/mark.jpg',
      });
      continue;
    }

    await downloadAvatar(channel);

    try {
      let raw = [];
      if (apiKey) {
        const api = await fetchApi(channel, apiKey, config.maxVideos || 200);
        raw = api.videos;
        usedApi = true;
        if (!live && api.live) live = api.live;
      } else {
        raw = await fetchRss(channel);
        usedRss = true;
      }
      if (!raw.length) throw new Error('Keine Videos');
      const mapped = raw.map((item) => toVideo(item, channel));
      videos.push(...mapped);
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: mapped.length,
        status: 'verbunden',
        avatar: channel.featured ? '/brand/mark.jpg' : channel.avatar || `/brand/${channel.channelId}.jpg`,
      });
    } catch (error) {
      failed += 1;
      console.error(`Kanal ${channel.name}: ${error instanceof Error ? error.message : 'Fehler'}`);
      const cached = asArray(previous.videos).filter((video) => video.channelId === channel.channelId);
      videos.push(...cached);
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: cached.length,
        status: 'fehler',
        avatar: channel.avatar || '/brand/mark.jpg',
      });
    }
  }

  if (!apiKey && !live) {
    const featured = channels.find((channel) => channel.enabled && channel.featured) || channels.find((channel) => channel.enabled);
    if (featured) {
      try {
        live = await detectLive(featured);
      } catch {
        live = null;
      }
    }
  }

  const deduped = [];
  const seen = new Set();
  for (const video of videos) {
    if (!video?.id || seen.has(video.id)) continue;
    seen.add(video.id);
    deduped.push(video);
  }
  deduped.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));

  await mkdir(mediaDir, { recursive: true });
  const thumbIds = [...new Set([...deduped.map((video) => video.id), ...(live ? [live.videoId] : [])])];
  await mapPool(thumbIds, 6, async (id) => {
    const file = path.join(mediaDir, `${id}.jpg`);
    try {
      await readFile(file);
      return;
    } catch {
      const buffer = await fetchThumb(id);
      if (buffer) await saveImage(file, buffer);
    }
  });

  const source = usedApi && usedRss ? 'mixed' : usedApi ? 'youtube-data-api' : usedRss ? 'rss' : previous.source || 'none';
  const catalog = {
    syncedAt: new Date().toISOString(),
    ok: failed === 0 && deduped.length > 0,
    source,
    error: failed ? 'Mindestens ein Kanal konnte nicht gelesen werden. Angezeigt werden gespeicherte Videos.' : null,
    live,
    channels: channelStats,
    videos: deduped,
  };

  if (!deduped.length && asArray(previous.videos).length) {
    console.error('Synchronisation ohne neue Videos, vorheriger Katalog bleibt erhalten.');
    process.exit(0);
  }

  const latest = deduped[0] || null;
  const feed = {
    syncedAt: catalog.syncedAt,
    live,
    latest: latest
      ? {
          title: latest.title,
          url: latest.url,
          pageUrl: `/videos/${latest.slug}/`,
          thumbnail: latest.thumbnail,
          publishedAt: latest.publishedAt,
        }
      : null,
    message: {
      headline: overlay.headline || '',
      ticker: overlay.ticker || '',
      custom: overlay.custom || '',
    },
  };

  await writeJson(catalogPath, catalog);
  await writeJson(feedPath, feed);
  await mkdir(publicData, { recursive: true });
  await writeJson(path.join(publicData, 'feed.json'), feed);
  console.log(`Synchronisiert: ${deduped.length} Videos, Quelle ${source}, Live ${live ? 'ja' : 'nein'}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
