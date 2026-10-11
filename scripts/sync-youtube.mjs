import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(import.meta.dirname, '..');
const configPath = path.join(root, 'src/config/youtube.json');
const tiktokConfigPath = path.join(root, 'src/config/tiktok.json');
const overlayPath = path.join(root, 'src/content/overlay.json');
const catalogPath = path.join(root, 'src/data/catalog.json');
const feedPath = path.join(root, 'src/data/feed.json');
const snapshotsPath = path.join(root, 'src/data/snapshots.json');
const publicData = path.join(root, 'public/data');
const mediaDir = path.join(root, 'public/media');
const brandDir = path.join(root, 'public/brand');

const EMPTY_VIDEO_STATS = { viewCount: null, likeCount: null, commentCount: null };
const EMPTY_CHANNEL_STATS = {
  subscriberCount: null,
  viewCount: null,
  videoCount: null,
  hiddenSubscriberCount: false,
};

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

function parseCount(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
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

function formatDurationSeconds(total) {
  const value = Number(total);
  if (!Number.isFinite(value) || value < 0) return null;
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  const ss = String(seconds).padStart(2, '0');
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${ss}`;
  return `${minutes}:${ss}`;
}

function parseLocalizedCount(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number(text);
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

const innertubeContext = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20250925.01.00',
    hl: 'de',
    gl: 'DE',
  },
};

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
    stats: {
      viewCount: raw.stats?.viewCount ?? null,
      likeCount: raw.stats?.likeCount ?? null,
      commentCount: raw.stats?.commentCount ?? null,
    },
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
      stats: { ...EMPTY_VIDEO_STATS },
    };
  }).filter((item) => item.id && item.title);
}

async function fetchChannelStats(channel, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/channels');
  url.searchParams.set('part', 'statistics,snippet');
  url.searchParams.set('id', channel.channelId);
  url.searchParams.set('key', apiKey);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`YouTube channels API ${response.status}`);
  const data = await response.json();
  const item = data.items?.[0];
  if (!item) return { ...EMPTY_CHANNEL_STATS };
  const stats = item.statistics || {};
  return {
    subscriberCount: stats.hiddenSubscriberCount ? null : parseCount(stats.subscriberCount),
    viewCount: parseCount(stats.viewCount),
    videoCount: parseCount(stats.videoCount),
    hiddenSubscriberCount: Boolean(stats.hiddenSubscriberCount),
  };
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
        stats: { ...EMPTY_VIDEO_STATS },
      });
    }
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }

  const details = new Map();
  for (let offset = 0; offset < collected.length; offset += 50) {
    const ids = collected.slice(offset, offset + 50).map((item) => item.id).join(',');
    const url = new URL('https://www.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'contentDetails,snippet,statistics');
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
    const statistics = detail?.statistics || {};
    item.durationLabel = formatDuration(detail?.contentDetails?.duration);
    item.stats = {
      viewCount: parseCount(statistics.viewCount),
      likeCount: parseCount(statistics.likeCount),
      commentCount: parseCount(statistics.commentCount),
    };
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

async function fetchPublicChannelStats(channel) {
  const urls = [
    channel.channelUrl ? `${channel.channelUrl.replace(/\/$/, '')}/about` : null,
    `https://www.youtube.com/channel/${channel.channelId}/about`,
  ].filter(Boolean);

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
          'accept-language': 'de-DE,de;q=0.9',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) continue;
      const html = await response.text();

      // Prefer the same public fields YouTube shows on the channel About tab.
      const subscriberText =
        html.match(/"subscriberCountText":"([^"]+)"/)?.[1] ||
        html.match(/"interactionType":\{"@type":"FollowAction"\},"userInteractionCount":"(\d+)"/)?.[1];
      const viewText = html.match(/"viewCountText":"([^"]+)"/)?.[1];
      const videoText = html.match(/"videoCountText":"([^"]+)"/)?.[1];

      const subscriberCount = parseLocalizedCount(subscriberText);
      const viewCount = parseLocalizedCount(viewText);
      const videoCount = parseLocalizedCount(videoText);

      if (subscriberCount == null && viewCount == null && videoCount == null) continue;

      return {
        subscriberCount,
        viewCount,
        videoCount,
        hiddenSubscriberCount: false,
      };
    } catch {
      continue;
    }
  }
  return { ...EMPTY_CHANNEL_STATS };
}

async function fetchPublicViewsFromBrowse(channel) {
  const views = new Map();
  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'de-DE,de;q=0.9',
      },
      body: JSON.stringify({
        context: innertubeContext,
        browseId: channel.channelId,
        params: 'EgZ2aWRlb3PyBgQKAjoA',
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return views;
    const payload = JSON.stringify(await response.json());
    const blocks = payload.split('"videoId":"').slice(1);
    for (const block of blocks) {
      const id = block.slice(0, 11);
      if (!/^[a-zA-Z0-9_-]{11}$/.test(id) || views.has(id)) continue;
      const window = block.slice(0, 2500);
      const match =
        window.match(/"content":"([\d.,\s]+)\s*Aufrufe"/) ||
        window.match(/"content":"([\d.,\s]+)\s*views"/i) ||
        window.match(/"simpleText":"([\d.,\s]+)\s*Aufrufe"/) ||
        window.match(/"simpleText":"([\d.,\s]+)\s*views"/i);
      const count = parseLocalizedCount(match?.[1]);
      if (count != null) views.set(id, count);
    }
  } catch {
    return views;
  }
  return views;
}

async function fetchPublicVideoDetails(videoId) {
  const stats = { ...EMPTY_VIDEO_STATS };
  let durationLabel = null;

  try {
    const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        context: innertubeContext,
        videoId,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (playerResponse.ok) {
      const player = await playerResponse.json();
      stats.viewCount = parseCount(player?.videoDetails?.viewCount);
      durationLabel = formatDurationSeconds(player?.videoDetails?.lengthSeconds);
    }
  } catch {
    // Continue with watch-page fallback.
  }

  try {
    const watchResponse = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=de`, {
      headers: {
        'user-agent': 'Mozilla/5.0',
        'accept-language': 'de-DE,de;q=0.9',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (watchResponse.ok) {
      const html = await watchResponse.text();
      if (stats.viewCount == null) {
        stats.viewCount = parseLocalizedCount(html.match(/"viewCount":"(\d+)"/)?.[1]);
      }
      stats.likeCount = parseLocalizedCount(html.match(/"likeCount":"(\d+)"/)?.[1]);
      const comments =
        html.match(/"text":"Kommentare"\}\]\},"contextualInfo":\{"runs":\[\{"text":"([^"]+)"\}/) ||
        html.match(/"text":"Comments"\}\]\},"contextualInfo":\{"runs":\[\{"text":"([^"]+)"\}/);
      stats.commentCount = parseLocalizedCount(comments?.[1]);
      if (!durationLabel) {
        durationLabel = formatDurationSeconds(html.match(/"lengthSeconds":"(\d+)"/)?.[1]);
      }
    }
  } catch {
    // Keep partial stats.
  }

  return { stats, durationLabel };
}

function mergeStats(current, previous) {
  return {
    viewCount: current?.viewCount ?? previous?.viewCount ?? null,
    likeCount: current?.likeCount ?? previous?.likeCount ?? null,
    commentCount: current?.commentCount ?? previous?.commentCount ?? null,
  };
}

async function enrichVideosWithPublicStats(rawVideos, channel, previousVideos = []) {
  const previousById = new Map(asArray(previousVideos).map((video) => [video.id, video]));
  const browseViews = await fetchPublicViewsFromBrowse(channel);

  await mapPool(rawVideos, 3, async (item) => {
    const previous = previousById.get(item.id);
    const details = await fetchPublicVideoDetails(item.id);
    const fromBrowse = browseViews.get(item.id) ?? null;
    item.stats = mergeStats(
      {
        viewCount: details.stats.viewCount ?? fromBrowse,
        likeCount: details.stats.likeCount,
        commentCount: details.stats.commentCount,
      },
      previous?.stats,
    );
    item.durationLabel = details.durationLabel || previous?.durationLabel || item.durationLabel || null;
  });

  for (const item of rawVideos) {
    if (item.stats?.viewCount == null && browseViews.has(item.id)) {
      item.stats = {
        ...(item.stats || { ...EMPTY_VIDEO_STATS }),
        viewCount: browseViews.get(item.id),
      };
    }
  }

  return rawVideos;
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

async function fetchTikTokProfile(config, previousTikTok) {
  const empty = {
    id: config.id || 'tiktok',
    name: config.name || 'TikTok',
    handle: config.handle || `@${config.uniqueId}`,
    uniqueId: config.uniqueId,
    profileUrl: config.profileUrl || `https://www.tiktok.com/@${config.uniqueId}`,
    description: config.description || '',
    avatar: config.avatar || '/brand/tiktok.jpg',
    status: 'fehler',
    stats: {
      followerCount: previousTikTok?.stats?.followerCount ?? null,
      likeCount: previousTikTok?.stats?.likeCount ?? null,
      videoCount: previousTikTok?.stats?.videoCount ?? null,
    },
  };
  if (!config.enabled || !config.uniqueId) return { ...empty, status: 'deaktiviert' };

  try {
    const response = await fetch(config.profileUrl || `https://www.tiktok.com/@${config.uniqueId}`, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'de-DE,de;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const match = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)<\/script>/s);
    if (!match) throw new Error('TikTok-Profildaten nicht gefunden');
    const payload = JSON.parse(match[1]);
    const info = payload?.__DEFAULT_SCOPE__?.['webapp.user-detail']?.userInfo;
    const user = info?.user;
    const stats = info?.stats || {};
    if (!user?.uniqueId) throw new Error('TikTok-Nutzer nicht gefunden');

    const avatarUrl = user.avatarMedium || user.avatarLarger || user.avatarThumb;
    if (avatarUrl && config.avatar) {
      try {
        const avatarResponse = await fetch(avatarUrl, { signal: AbortSignal.timeout(20000) });
        if (avatarResponse.ok) {
          const buffer = Buffer.from(await avatarResponse.arrayBuffer());
          if (buffer.length > 500) {
            await saveImage(path.join(root, 'public', config.avatar.replace(/^\//, '')), buffer);
          }
        }
      } catch {
        // Keep previous avatar.
      }
    }

    return {
      id: config.id || 'tiktok',
      name: user.nickname || config.name || 'TikTok',
      handle: `@${user.uniqueId}`,
      uniqueId: user.uniqueId,
      profileUrl: config.profileUrl || `https://www.tiktok.com/@${user.uniqueId}`,
      description: user.signature || config.description || '',
      avatar: config.avatar || '/brand/tiktok.jpg',
      status: 'verbunden',
      stats: {
        followerCount: parseCount(stats.followerCount),
        likeCount: parseCount(stats.heartCount ?? stats.heart),
        videoCount: parseCount(stats.videoCount),
      },
    };
  } catch (error) {
    console.error(`TikTok: ${error instanceof Error ? error.message : 'Fehler'}`);
    return empty;
  }
}

async function downloadAvatar(channel) {
  if (!channel.avatarUrl) return;
  try {
    const response = await fetch(channel.avatarUrl, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) return;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 500) return;
    const target = channel.featured
      ? path.join(brandDir, 'mark.jpg')
      : path.join(brandDir, `${channel.channelId}.jpg`);
    await saveImage(target, buffer);
  } catch {
    console.error(`Avatar nicht geladen: ${channel.name}`);
  }
}

function pruneSnapshots(store, now = Date.now()) {
  const keepMs = 40 * 24 * 60 * 60 * 1000;
  const minAt = now - keepMs;
  store.channelSnapshots = asArray(store.channelSnapshots).filter((item) => Date.parse(item.at) >= minAt);
  store.videoSnapshots = asArray(store.videoSnapshots).filter((item) => Date.parse(item.at) >= minAt);
  return store;
}

function tiktokAsStatsChannel(tiktok) {
  if (!tiktok) return null;
  return {
    id: 'tiktok',
    channelId: 'tiktok',
    name: 'TikTok',
    slug: '',
    platform: 'tiktok',
    handle: tiktok.handle || '',
    profileUrl: tiktok.profileUrl || '',
    stats: {
      subscriberCount: tiktok.stats?.followerCount ?? null,
      viewCount: null,
      videoCount: tiktok.stats?.videoCount ?? null,
      likeCount: tiktok.stats?.likeCount ?? null,
      hiddenSubscriberCount: false,
    },
  };
}

function buildPublicStats(catalog, snapshots) {
  const tiktokChannel = tiktokAsStatsChannel(catalog.tiktok);
  return {
    syncedAt: catalog.syncedAt,
    timezone: 'Europe/Zurich',
    channels: [
      ...catalog.channels.map((channel) => ({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        slug: channel.slug || '',
        platform: 'youtube',
        stats: channel.stats || { ...EMPTY_CHANNEL_STATS },
      })),
      ...(tiktokChannel ? [tiktokChannel] : []),
    ],
    videos: catalog.videos.slice(0, 40).map((video) => ({
      id: video.id,
      channelId: video.channelId,
      stats: video.stats || { ...EMPTY_VIDEO_STATS },
    })),
    tiktok: catalog.tiktok || null,
    channelSnapshots: asArray(snapshots.channelSnapshots).slice(-4000),
    videoSnapshots: asArray(snapshots.videoSnapshots).slice(-8000),
  };
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const tiktokConfig = await readJson(tiktokConfigPath, { enabled: false, uniqueId: '' });
  const previous = await readJson(catalogPath, { videos: [], channels: [], live: null, tiktok: null });
  const overlay = await readJson(overlayPath, { headline: '', ticker: '', custom: '' });
  const snapshots = pruneSnapshots(
    await readJson(snapshotsPath, {
      timezone: 'Europe/Zurich',
      channelSnapshots: [],
      videoSnapshots: [],
    }),
  );
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
  let usedPublic = false;
  let failed = 0;
  const syncedAt = new Date().toISOString();
  const tiktok = await fetchTikTokProfile(tiktokConfig, previous.tiktok);
  if (tiktok.status === 'verbunden') {
    snapshots.channelSnapshots.push({
      at: syncedAt,
      channelId: 'tiktok',
      subscriberCount: tiktok.stats.followerCount,
      viewCount: tiktok.stats.likeCount,
      videoCount: tiktok.stats.videoCount,
    });
  }

  for (const channel of channels.sort((a, b) => a.displayOrder - b.displayOrder)) {
    if (!channel.enabled) {
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: 0,
        status: 'deaktiviert',
        avatar: channel.avatar || '/brand/mark.jpg',
        slug: channel.slug,
        handle: channel.handle,
        channelUrl: channel.channelUrl,
        subscribeUrl: channel.subscribeUrl || `${String(channel.channelUrl || '').replace(/\/$/, '')}?sub_confirmation=1`,
        stats: { ...EMPTY_CHANNEL_STATS },
      });
      continue;
    }

    await downloadAvatar(channel);

    try {
      let raw = [];
      let publicStats = { ...EMPTY_CHANNEL_STATS };
      if (apiKey) {
        const api = await fetchApi(channel, apiKey, config.maxVideos || 200);
        raw = api.videos;
        usedApi = true;
        if (!live && api.live) live = api.live;
        publicStats = await fetchChannelStats(channel, apiKey);
      } else {
        raw = await fetchRss(channel);
        usedRss = true;
        const previousForChannel = asArray(previous.videos).filter((video) => video.channelId === channel.channelId);
        await enrichVideosWithPublicStats(raw, channel, previousForChannel);
        publicStats = await fetchPublicChannelStats(channel);
        const previousChannel = asArray(previous.channels).find((item) => item.channelId === channel.channelId);
        if (publicStats.subscriberCount == null && previousChannel?.stats?.subscriberCount != null) {
          publicStats = {
            ...publicStats,
            subscriberCount: previousChannel.stats.subscriberCount,
            hiddenSubscriberCount: previousChannel.stats.hiddenSubscriberCount || false,
          };
        }
        usedPublic = true;
      }
      if (!raw.length) throw new Error('Keine Videos');
      const mapped = raw.map((item) => toVideo(item, channel));
      if (!apiKey && publicStats.videoCount == null) {
        publicStats = { ...publicStats, videoCount: mapped.length };
      }
      videos.push(...mapped);
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: mapped.length,
        status: 'verbunden',
        avatar: channel.featured ? '/brand/mark.jpg' : channel.avatar || `/brand/${channel.channelId}.jpg`,
        slug: channel.slug,
        handle: channel.handle,
        channelUrl: channel.channelUrl,
        subscribeUrl: channel.subscribeUrl || `${String(channel.channelUrl || '').replace(/\/$/, '')}?sub_confirmation=1`,
        stats: publicStats,
      });

      snapshots.channelSnapshots.push({
        at: syncedAt,
        channelId: channel.channelId,
        subscriberCount: publicStats.subscriberCount,
        viewCount: publicStats.viewCount,
        videoCount: publicStats.videoCount,
      });
      for (const video of mapped.slice(0, 30)) {
        snapshots.videoSnapshots.push({
          at: syncedAt,
          videoId: video.id,
          channelId: video.channelId,
          viewCount: video.stats.viewCount,
          likeCount: video.stats.likeCount,
          commentCount: video.stats.commentCount,
        });
      }
    } catch (error) {
      failed += 1;
      console.error(`Kanal ${channel.name}: ${error instanceof Error ? error.message : 'Fehler'}`);
      const cached = asArray(previous.videos).filter((video) => video.channelId === channel.channelId);
      videos.push(...cached.map((video) => ({
        ...video,
        stats: video.stats || { ...EMPTY_VIDEO_STATS },
      })));
      const previousChannel = asArray(previous.channels).find((item) => item.channelId === channel.channelId);
      channelStats.push({
        id: channel.id,
        channelId: channel.channelId,
        name: channel.name,
        videoCount: cached.length,
        status: 'fehler',
        avatar: channel.avatar || '/brand/mark.jpg',
        slug: channel.slug,
        handle: channel.handle,
        channelUrl: channel.channelUrl,
        subscribeUrl: channel.subscribeUrl || previousChannel?.subscribeUrl || `${String(channel.channelUrl || '').replace(/\/$/, '')}?sub_confirmation=1`,
        stats: previousChannel?.stats || { ...EMPTY_CHANNEL_STATS },
      });
    }
  }

  if (!apiKey && !live) {
    for (const channel of channels.filter((item) => item.enabled)) {
      try {
        live = await detectLive(channel);
        if (live) break;
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
    deduped.push({
      ...video,
      stats: video.stats || { ...EMPTY_VIDEO_STATS },
    });
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

  const source =
    usedApi && (usedRss || usedPublic)
      ? 'mixed'
      : usedApi
        ? 'youtube-data-api'
        : usedPublic
          ? 'youtube-public'
          : usedRss
            ? 'rss'
            : previous.source || 'none';
  const catalog = {
    syncedAt,
    ok: failed === 0 && deduped.length > 0,
    source,
    error: failed
      ? 'Mindestens ein Kanal konnte nicht gelesen werden. Angezeigt werden gespeicherte Videos.'
      : null,
    live,
    channels: channelStats,
    videos: deduped,
    tiktok,
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
          channelId: latest.channelId,
          channelName: latest.channelName,
        }
      : null,
    channels: channelStats.map((channel) => ({
      id: channel.id,
      channelId: channel.channelId,
      name: channel.name,
      slug: channel.slug || '',
      stats: channel.stats || { ...EMPTY_CHANNEL_STATS },
    })),
    message: {
      headline: overlay.headline || '',
      ticker: overlay.ticker || '',
      custom: overlay.custom || '',
    },
  };

  pruneSnapshots(snapshots);
  const publicStats = buildPublicStats(catalog, snapshots);

  await writeJson(catalogPath, catalog);
  await writeJson(feedPath, feed);
  await writeJson(snapshotsPath, snapshots);
  await mkdir(publicData, { recursive: true });
  await writeJson(path.join(publicData, 'feed.json'), feed);
  await writeJson(path.join(publicData, 'stats.json'), publicStats);
  console.log(
    `Synchronisiert: ${deduped.length} Videos, ${channelStats.filter((item) => item.status === 'verbunden').length} Kanäle, Quelle ${source}, Live ${live ? 'ja' : 'nein'}, TikTok ${tiktok.status}${tiktok.stats.followerCount != null ? ` (${tiktok.stats.followerCount} Follower)` : ''}.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
