type Period = '24h' | '7d' | '30d';
type GrowthMetric = 'views' | 'subscribers';

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

    // If channel lifetime views are still flat/scarce, show authentic video-view growth.
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

    const series = buildSeries(payload, ids, period, growthMetric);
    const first = series[0]?.value ?? null;
    const last = series[series.length - 1]?.value ?? null;
    const delta = first != null && last != null ? last - first : null;
    const metricLabel = growthMetric === 'subscribers' ? 'Abonnenten' : 'Aufrufe';

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
      } else if (growthMetric === 'views' && !(payload.snapshots.channelSnapshots || []).some((item) => ids.has(item.channelId) && item.viewCount != null)) {
        growthCaption.textContent = `Echte Aufruf-Zunahme der aktuellen Videos · ${periodLabel(period)}`;
      } else {
        growthCaption.textContent = `Echte Messwerte · ${periodLabel(period)}`;
      }
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

  render();
}
