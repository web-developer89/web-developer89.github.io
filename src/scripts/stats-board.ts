type Period = '24h' | '7d' | '30d';

type Payload = {
  syncedAt: string | null;
  channels: Array<{
    id: string;
    channelId: string;
    name: string;
    stats: {
      subscriberCount: number | null;
      viewCount: number | null;
      videoCount: number | null;
    };
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

export function setupStatsBoard(): void {
  const root = document.querySelector('[data-stats-board]');
  const payloadNode = document.querySelector('#stats-payload');
  if (!(root instanceof HTMLElement) || !(payloadNode instanceof HTMLElement)) return;

  let payload: Payload;
  try {
    payload = JSON.parse(payloadNode.textContent || '{}') as Payload;
  } catch {
    return;
  }

  let channelFilter = payload.channels.some((channel) => channel.id === 'primary') ? 'primary' : 'all';
  let period: Period = '7d';
  const grid = root.querySelector('[data-metric-grid]');
  const chartRoot = root.querySelector('[data-chart-root]');
  if (!(grid instanceof HTMLElement) || !(chartRoot instanceof HTMLElement)) return;

  const channelIds = () => {
    if (channelFilter === 'all') return payload.channels.map((channel) => channel.channelId);
    const match = payload.channels.find((channel) => channel.id === channelFilter);
    return match ? [match.channelId] : [];
  };

  const render = () => {
    const ids = new Set(channelIds());
    const channels = payload.channels.filter((channel) => ids.has(channel.channelId));
    const videos = payload.videos.filter((video) => ids.has(video.channelId));
    const target = Date.now() - PERIOD_MS[period];

    const totals = {
      subscribers: sum(channels.map((channel) => channel.stats?.subscriberCount)),
      views: sum(channels.map((channel) => channel.stats?.viewCount)) ?? sum(videos.map((video) => video.stats?.viewCount)),
      likes: sum(videos.map((video) => video.stats?.likeCount)),
      comments: sum(videos.map((video) => video.stats?.commentCount)),
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

    const previous = {
      subscribers: sum(previousChannels.map((item) => item?.subscriberCount ?? null)),
      views:
        sum(previousChannels.map((item) => item?.viewCount ?? null)) ??
        sum([...previousVideos.values()].map((item) => item.viewCount)),
      likes: sum([...previousVideos.values()].map((item) => item.likeCount)),
      comments: sum([...previousVideos.values()].map((item) => item.commentCount)),
    };

    const insufficient = previousChannels.length === 0 && previousVideos.size === 0;
    const subscriberHint =
      channelFilter === 'all' && totals.subscribers != null
        ? 'Summe beider Kanäle laut YouTube'
        : 'Abonnenten insgesamt laut YouTube';

    const cards = [
      {
        label: 'Aufrufe',
        total: totals.views,
        change: totals.views != null && previous.views != null ? totals.views - previous.views : null,
        emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
        okHint: periodLabel(period),
        totalHint: channelFilter === 'all' ? 'Aufrufe insgesamt beider Kanäle' : 'Aufrufe insgesamt laut YouTube',
      },
      {
        label: 'Likes',
        total: totals.likes,
        change: totals.likes != null && previous.likes != null ? totals.likes - previous.likes : null,
        emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
        okHint: periodLabel(period),
        totalHint: 'Likes der übernommenen Videos',
      },
      {
        label: 'Kommentare',
        total: totals.comments,
        change: totals.comments != null && previous.comments != null ? totals.comments - previous.comments : null,
        emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
        okHint: periodLabel(period),
        totalHint: 'Kommentare der übernommenen Videos',
      },
      {
        label: 'Abonnenten',
        total: totals.subscribers,
        change: totals.subscribers != null && previous.subscribers != null ? totals.subscribers - previous.subscribers : null,
        emptyHint: 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.',
        okHint: periodLabel(period),
        totalHint: subscriberHint,
      },
    ];

    grid.innerHTML = cards
      .map((card) => {
        const changeBlock =
          insufficient || card.change == null
            ? `<p class="hint">${card.total != null ? card.totalHint : card.emptyHint}</p>`
            : `<p class="change">${formatSigned(card.change)}</p><p class="hint">${card.okHint}</p>`;
        return `<article class="metric-card"><p class="label">${card.label}</p><p class="value">${formatNumber(card.total)}</p>${changeBlock}</article>`;
      })
      .join('');

    const pointsMap = new Map<string, number>();
    for (const snap of payload.snapshots.channelSnapshots || []) {
      if (!ids.has(snap.channelId) || snap.viewCount == null) continue;
      const at = Date.parse(snap.at);
      if (Number.isNaN(at) || at < target) continue;
      pointsMap.set(snap.at, (pointsMap.get(snap.at) || 0) + snap.viewCount);
    }
    const series = [...pointsMap.entries()]
      .map(([at, value]) => ({ at, value }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

    if (series.length < 2) {
      chartRoot.innerHTML = `<p class="hint">Für diesen Zeitraum liegen noch nicht genügend Daten vor.</p>`;
      return;
    }

    const max = Math.max(...series.map((point) => point.value), 1);
    const points = series
      .map((point, index) => {
        const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 100;
        const y = 100 - (point.value / max) * 88 - 6;
        return `${x},${y}`;
      })
      .join(' ');
    chartRoot.innerHTML = `<svg viewBox="0 0 100 100" role="img" aria-label="Entwicklung der Aufrufe im gewählten Zeitraum"><polyline fill="none" stroke="var(--accent)" stroke-width="1.8" points="${points}"></polyline></svg>`;
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

  root.querySelectorAll('[data-channel]').forEach((node) => {
    node.classList.toggle('is-active', (node as HTMLElement).dataset.channel === channelFilter);
  });

  render();
}
