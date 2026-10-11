type Period = '24h' | '7d' | '30d';
type GrowthMetric = 'views' | 'subscribers';

type ChannelStats = {
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  likeCount?: number | null;
  hiddenSubscriberCount?: boolean;
};

type Payload = {
  syncedAt: string | null;
  channels: Array<{
    id: string;
    channelId: string;
    name: string;
    platform?: 'youtube' | 'tiktok' | string;
    stats: ChannelStats;
  }>;
  videos: Array<{
    id: string;
    channelId: string;
    stats: {
      viewCount: number | null;
      likeCount: number | null;
      commentCount: number | null;
    };
  }>;
  snapshots: {
    channelSnapshots: Array<{
      at: string;
      channelId: string;
      subscriberCount: number | null;
      viewCount: number | null;
    }>;
    videoSnapshots: Array<{
      at: string;
      videoId: string;
      channelId: string;
      viewCount: number | null;
      likeCount: number | null;
      commentCount: number | null;
    }>;
  };
};

const PERIOD_MS: Record<Period, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function formatNumber(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}

function formatSigned(value: number | null): string {
  if (value == null || Number.isNaN(value)) return '—';
  const abs = formatNumber(Math.abs(value));
  if (value > 0) return `+${abs}`;
  if (value < 0) return `−${abs}`;
  return abs;
}

function formatStamp(iso: string): string {
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(new Date(iso));
}

function periodLabel(period: Period): string {
  if (period === '24h') return 'In den letzten 24 Stunden';
  if (period === '7d') return 'In den letzten 7 Tagen';
  return 'In den letzten 30 Tagen';
}

function sum(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => typeof value === 'number');
  if (!usable.length) return null;
  return usable.reduce((total, value) => total + value, 0);
}

function closestBefore<T extends { at: string }>(items: T[], target: number): T | null {
  let best: T | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const at = Date.parse(item.at);
    if (Number.isNaN(at) || at > target + 3 * 60 * 60 * 1000) continue;
    const delta = Math.abs(at - target);
    if (delta < bestDelta) {
      best = item;
      bestDelta = delta;
    }
  }
  return best;
}

function normalizeRemoteStats(data: Record<string, unknown>): Payload | null {
  if (!data || typeof data !== 'object') return null;
  const channels = Array.isArray(data.channels) ? data.channels : [];
  const videos = Array.isArray(data.videos) ? data.videos : [];
  return {
    syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : null,
    channels: channels as Payload['channels'],
    videos: videos as Payload['videos'],
    snapshots: {
      channelSnapshots: (Array.isArray(data.channelSnapshots) ? data.channelSnapshots : []) as Payload['snapshots']['channelSnapshots'],
      videoSnapshots: (Array.isArray(data.videoSnapshots) ? data.videoSnapshots : []) as Payload['snapshots']['videoSnapshots'],
    },
  };
}

function buildSeries(
  payload: Payload,
  ids: Set<string>,
  period: Period,
  metric: GrowthMetric,
): Array<{ at: string; value: number }> {
  const since = Date.now() - PERIOD_MS[period];
  const points = new Map<string, number>();

  if (metric === 'subscribers') {
    for (const snap of payload.snapshots.channelSnapshots || []) {
      if (!ids.has(snap.channelId) || snap.subscriberCount == null) continue;
      const at = Date.parse(snap.at);
      if (Number.isNaN(at) || at < since) continue;
      points.set(snap.at, (points.get(snap.at) || 0) + snap.subscriberCount);
    }
  } else {
    for (const snap of payload.snapshots.channelSnapshots || []) {
      if (!ids.has(snap.channelId) || snap.viewCount == null) continue;
      const at = Date.parse(snap.at);
      if (Number.isNaN(at) || at < since) continue;
      points.set(snap.at, (points.get(snap.at) || 0) + snap.viewCount);
    }

    if (points.size < 2) {
      points.clear();
      const byTime = new Map<string, Map<string, number>>();
      for (const snap of payload.snapshots.videoSnapshots || []) {
        if (!ids.has(snap.channelId) || snap.viewCount == null) continue;
        const at = Date.parse(snap.at);
        if (Number.isNaN(at) || at < since) continue;
        const bucket = byTime.get(snap.at) || new Map<string, number>();
        bucket.set(snap.videoId, snap.viewCount);
        byTime.set(snap.at, bucket);
      }
      for (const [at, bucket] of byTime) {
        points.set(at, [...bucket.values()].reduce((total, value) => total + value, 0));
      }
    }
  }

  return [...points.entries()]
    .map(([at, value]) => ({ at, value }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function renderSparkline(series: Array<{ at: string; value: number }>): string {
  const width = 280;
  const height = 64;
  const padX = 4;
  const padY = 8;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coords = series.map((point, index) => {
    const x = padX + (series.length === 1 ? 0 : (index / (series.length - 1)) * (width - padX * 2));
    const y = height - padY - ((point.value - min) / span) * (height - padY * 2);
    return { x, y };
  });
  const line = coords.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = `${padX},${height - padY} ${line} ${width - padX},${height - padY}`;
  const last = coords[coords.length - 1];
  const rising = values[values.length - 1] >= values[0];
  const stroke = rising ? 'var(--accent)' : 'var(--danger)';

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Kompakte Entwicklung der gewählten Kennzahl">
      <defs>
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${rising ? '#d4b07a' : '#ffb4ae'}" stop-opacity="0.28" />
          <stop offset="100%" stop-color="${rising ? '#d4b07a' : '#ffb4ae'}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon fill="url(#growthFill)" points="${area}"></polygon>
      <polyline fill="none" stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${line}"></polyline>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="3.2" fill="${stroke}"></circle>
    </svg>
  `;
}

export function setupStatsBoard(): void {
  const root = document.querySelector('[data-stats-board]');
  const payloadNode = document.querySelector('#stats-payload');
  const section = document.querySelector('[data-stats-refresh]');
  if (!(root instanceof HTMLElement) || !(payloadNode instanceof HTMLElement)) return;

  let payload: Payload;
  try {
    payload = JSON.parse(payloadNode.textContent || '{}') as Payload;
  } catch {
    return;
  }

  let channelFilter = payload.channels.some((channel) => channel.id === 'primary') ? 'primary' : 'all';
  let period: Period = '7d';
  let growthMetric: GrowthMetric = 'views';
  const grid = root.querySelector('[data-metric-grid]');
  const chartRoot = root.querySelector('[data-chart-root]');
  const growthDelta = root.querySelector('[data-growth-delta]');
  const growthCaption = root.querySelector('[data-growth-caption]');
  const growthMetricFilters = root.querySelector('[data-growth-metric-filters]');
  const stamp = section?.querySelector('[data-sync-stamp]');
  if (!(grid instanceof HTMLElement) || !(chartRoot instanceof HTMLElement)) return;

  const selectedChannels = () => {
    if (channelFilter === 'all') return payload.channels;
    return payload.channels.filter((channel) => channel.id === channelFilter);
  };

  const channelIds = () => selectedChannels().map((channel) => channel.channelId);

  const isTikTokOnly = () => channelFilter === 'tiktok';
  const includesTikTok = () => selectedChannels().some((channel) => channel.platform === 'tiktok' || channel.id === 'tiktok');

  const syncGrowthLabels = () => {
    if (!(growthMetricFilters instanceof HTMLElement)) return;
    const buttons = [...growthMetricFilters.querySelectorAll<HTMLButtonElement>('[data-growth-metric]')];
    for (const button of buttons) {
      if (button.dataset.growthMetric === 'views') {
        button.textContent = isTikTokOnly() ? 'Likes' : 'Aufrufe';
      }
      if (button.dataset.growthMetric === 'subscribers') {
        button.textContent = isTikTokOnly() ? 'Follower' : 'Abonnenten';
      }
    }
  };

  const render = () => {
    syncGrowthLabels();
    const ids = new Set(channelIds());
    const channels = selectedChannels();
    const youtubeChannels = channels.filter((channel) => channel.platform !== 'tiktok' && channel.id !== 'tiktok');
    const tiktokChannels = channels.filter((channel) => channel.platform === 'tiktok' || channel.id === 'tiktok');
    const videos = payload.videos.filter((video) => ids.has(video.channelId));
    const target = Date.now() - PERIOD_MS[period];

    const youtubeLikes = sum(videos.map((video) => video.stats?.likeCount));
    const tiktokLikes = sum(tiktokChannels.map((channel) => channel.stats?.likeCount ?? null));

    const totals = isTikTokOnly()
      ? {
          followers: sum(tiktokChannels.map((channel) => channel.stats?.subscriberCount)),
          likes: tiktokLikes,
          videos: sum(tiktokChannels.map((channel) => channel.stats?.videoCount)),
          views: null as number | null,
          comments: null as number | null,
          subscribers: null as number | null,
        }
      : {
          views: sum(youtubeChannels.map((channel) => channel.stats?.viewCount)) ?? sum(videos.map((video) => video.stats?.viewCount)),
          likes: sum([youtubeLikes, includesTikTok() ? tiktokLikes : null]),
          comments: sum(videos.map((video) => video.stats?.commentCount)),
          subscribers: sum([
            sum(youtubeChannels.map((channel) => channel.stats?.subscriberCount)),
            includesTikTok() ? sum(tiktokChannels.map((channel) => channel.stats?.subscriberCount)) : null,
          ]),
          followers: null as number | null,
          videos: null as number | null,
        };

    const previousChannels = [...ids]
      .map((channelId) =>
        closestBefore(
          (payload.snapshots.channelSnapshots || []).filter((item) => item.channelId === channelId),
          target,
        ),
      )
      .filter(Boolean);

    const previousVideos = new Map<string, (typeof payload.snapshots.videoSnapshots)[number]>();
    for (const videoId of new Set((payload.snapshots.videoSnapshots || []).filter((item) => ids.has(item.channelId)).map((item) => item.videoId))) {
      const closest = closestBefore(
        (payload.snapshots.videoSnapshots || []).filter((item) => item.videoId === videoId),
        target,
      );
      if (closest) previousVideos.set(videoId, closest);
    }

    const previousTikTok = previousChannels.filter((item) => item?.channelId === 'tiktok');
    const previousYoutube = previousChannels.filter((item) => item?.channelId !== 'tiktok');

    const prevFollowers = sum(previousTikTok.map((item) => item?.subscriberCount ?? null));
    const prevTikTokLikes = sum(previousTikTok.map((item) => item?.viewCount ?? null));
    const prevTikTokVideos = sum(previousTikTok.map((item) => (item as { videoCount?: number | null })?.videoCount ?? null));
    const prevSubscribers = sum([
      sum(previousYoutube.map((item) => item?.subscriberCount ?? null)),
      includesTikTok() ? prevFollowers : null,
    ]);
    const prevViews =
      sum(previousYoutube.map((item) => item?.viewCount ?? null)) ??
      sum([...previousVideos.values()].map((item) => item.viewCount));
    const prevLikes = sum([
      sum([...previousVideos.values()].map((item) => item.likeCount)),
      includesTikTok() ? prevTikTokLikes : null,
    ]);
    const prevComments = sum([...previousVideos.values()].map((item) => item.commentCount));

    const insufficient = previousChannels.length === 0 && previousVideos.size === 0;

    const cards = isTikTokOnly()
      ? [
          {
            label: 'Follower',
            total: totals.followers,
            change: totals.followers != null && prevFollowers != null ? totals.followers - prevFollowers : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: 'Follower insgesamt laut TikTok',
          },
          {
            label: 'Likes',
            total: totals.likes,
            change: totals.likes != null && prevTikTokLikes != null ? totals.likes - prevTikTokLikes : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: 'Likes insgesamt laut TikTok',
          },
          {
            label: 'Videos',
            total: totals.videos,
            change: totals.videos != null && prevTikTokVideos != null ? totals.videos - prevTikTokVideos : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: 'Videos insgesamt laut TikTok',
          },
        ]
      : [
          {
            label: 'Aufrufe',
            total: totals.views,
            change: totals.views != null && prevViews != null ? totals.views - prevViews : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: channelFilter === 'all' ? 'YouTube-Aufrufe insgesamt' : 'Aufrufe insgesamt laut YouTube',
          },
          {
            label: 'Likes',
            total: totals.likes,
            change: totals.likes != null && prevLikes != null ? totals.likes - prevLikes : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: includesTikTok() ? 'YouTube-Video-Likes + TikTok-Likes' : 'Likes der übernommenen Videos',
          },
          {
            label: 'Kommentare',
            total: totals.comments,
            change: totals.comments != null && prevComments != null ? totals.comments - prevComments : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint: 'Kommentare der übernommenen Videos',
          },
          {
            label: 'Abonnenten',
            total: totals.subscribers,
            change: totals.subscribers != null && prevSubscribers != null ? totals.subscribers - prevSubscribers : null,
            emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
            okHint: periodLabel(period),
            totalHint:
              channelFilter === 'all' && includesTikTok()
                ? 'YouTube-Abonnenten + TikTok-Follower'
                : 'Abonnenten insgesamt laut YouTube',
          },
        ];

    grid.classList.toggle('is-compact', isTikTokOnly());
    grid.innerHTML = cards
      .map((card) => {
        const changeBlock =
          insufficient || card.change == null
            ? `<p class="hint">${card.total != null ? card.totalHint : card.emptyHint}</p>`
            : `<p class="change">${formatSigned(card.change)}</p><p class="hint">${card.okHint}</p>`;
        return `<article class="metric-card"><p class="label">${card.label}</p><p class="value">${formatNumber(card.total)}</p>${changeBlock}</article>`;
      })
      .join('');

    const series = buildSeries(payload, ids, period, growthMetric);
    const first = series[0]?.value ?? null;
    const last = series[series.length - 1]?.value ?? null;
    const delta = first != null && last != null ? last - first : null;
    const metricLabel = isTikTokOnly()
      ? growthMetric === 'subscribers'
        ? 'Follower'
        : 'Likes'
      : growthMetric === 'subscribers'
        ? 'Abonnenten'
        : 'Aufrufe';

    if (growthDelta instanceof HTMLElement) {
      growthDelta.textContent =
        delta == null
          ? 'Noch zu wenig Messpunkte'
          : `${formatSigned(delta)} ${metricLabel}`;
      growthDelta.classList.toggle('is-flat', delta === 0);
      growthDelta.classList.toggle('is-down', typeof delta === 'number' && delta < 0);
    }

    if (growthCaption instanceof HTMLElement) {
      if (series.length < 2) {
        growthCaption.textContent = 'Sobald mehrere Syncs vorliegen, erscheint hier die echte Wachstumskurve.';
      } else if (isTikTokOnly()) {
        growthCaption.textContent = `Echte TikTok-Messwerte · ${periodLabel(period)}`;
      } else if (growthMetric === 'views' && !(payload.snapshots.channelSnapshots || []).some((item) => ids.has(item.channelId) && item.viewCount != null && item.channelId !== 'tiktok')) {
        growthCaption.textContent = `Echte Aufruf-Zunahme der aktuellen Videos · ${periodLabel(period)}`;
      } else {
        growthCaption.textContent = `Echte Messwerte · ${periodLabel(period)}`;
      }
    }

    if (stamp instanceof HTMLElement && payload.syncedAt) {
      stamp.setAttribute('datetime', payload.syncedAt);
      stamp.textContent = formatStamp(payload.syncedAt);
    }

    if (series.length < 2) {
      chartRoot.innerHTML = `<p class="growth-note">Kurve folgt mit den nächsten Synchronisierungen.</p>`;
      return;
    }

    chartRoot.innerHTML = renderSparkline(series);
  };

  root.querySelectorAll<HTMLButtonElement>('[data-channel]').forEach((button) => {
    button.addEventListener('click', () => {
      channelFilter = button.dataset.channel || 'all';
      root.querySelectorAll('[data-channel]').forEach((node) => node.classList.toggle('is-active', node === button));
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => {
    button.addEventListener('click', () => {
      period = (button.dataset.period as Period) || '7d';
      root.querySelectorAll('[data-period]').forEach((node) => node.classList.toggle('is-active', node === button));
      render();
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-growth-metric]').forEach((button) => {
    button.addEventListener('click', () => {
      growthMetric = (button.dataset.growthMetric as GrowthMetric) || 'views';
      root.querySelectorAll('[data-growth-metric]').forEach((node) => node.classList.toggle('is-active', node === button));
      render();
    });
  });

  root.querySelectorAll('[data-channel]').forEach((node) => {
    node.classList.toggle('is-active', (node as HTMLElement).dataset.channel === channelFilter);
  });

  const refreshFromNetwork = async () => {
    try {
      const response = await fetch(`/data/stats.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const next = normalizeRemoteStats(await response.json());
      if (!next?.channels?.length) return;
      payload = next;
      payloadNode.textContent = JSON.stringify(next);
      render();
    } catch {
      // Keep last known payload.
    }
  };

  render();
  window.setInterval(refreshFromNetwork, 60_000);
}
