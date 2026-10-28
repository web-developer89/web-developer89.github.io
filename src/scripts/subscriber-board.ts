type Period = '24h' | '7d' | '30d';

type ChannelPayload = {
  id: string;
  channelId: string;
  name: string;
  slug: string;
  avatar: string;
  subscribeUrl: string;
  stats: {
    subscriberCount: number | null;
    hiddenSubscriberCount?: boolean;
  };
};

type Payload = {
  syncedAt: string | null;
  syncOk?: boolean;
  syncError?: string | null;
  channels: ChannelPayload[];
  combined: number | null;
  snapshots: {
    channelSnapshots: Array<{
      at: string;
      channelId: string;
      subscriberCount: number | null;
    }>;
  };
};

const PERIOD_MS: Record<Period, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const COLORS: Record<string, string> = {
  primary: '#d4b07a',
  reagiert: '#8fa3b8',
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
  if (period === '24h') return 'in den letzten 24 Stunden';
  if (period === '7d') return 'in den letzten 7 Tagen';
  return 'in den letzten 30 Tagen';
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

function seriesForChannel(
  payload: Payload,
  channelId: string,
  period: Period,
): Array<{ at: string; value: number }> {
  const since = Date.now() - PERIOD_MS[period];
  const points: Array<{ at: string; value: number }> = [];
  for (const snap of payload.snapshots.channelSnapshots || []) {
    if (snap.channelId !== channelId || snap.subscriberCount == null) continue;
    const at = Date.parse(snap.at);
    if (Number.isNaN(at) || at < since) continue;
    points.push({ at: snap.at, value: snap.subscriberCount });
  }
  return points.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

function netChange(payload: Payload, channelId: string, period: Period): number | null {
  const current = payload.channels.find((channel) => channel.channelId === channelId)?.stats.subscriberCount ?? null;
  const snaps = (payload.snapshots.channelSnapshots || []).filter((item) => item.channelId === channelId);
  const previous = closestBefore(snaps, Date.now() - PERIOD_MS[period]);
  if (current == null || previous?.subscriberCount == null) return null;
  return current - previous.subscriberCount;
}

function renderSpark(series: Array<{ at: string; value: number }>, color: string): string {
  if (series.length < 2) {
    return `<p class="growth-note">Für diesen Zeitraum liegen noch nicht genügend Daten vor.</p>`;
  }
  const width = 320;
  const height = 32;
  const padX = 4;
  const padY = 8;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const coords = series.map((point, index) => {
    const x = padX + (index / (series.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.value - min) / span) * (height - padY * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true">
      <polyline fill="none" stroke="${color}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(' ')}"></polyline>
    </svg>
  `;
}

function normalizeRemote(data: Record<string, unknown>, current: Payload): Payload | null {
  if (!data || typeof data !== 'object') return null;
  const remoteChannels = Array.isArray(data.channels) ? data.channels : [];
  const youtubeRemote = remoteChannels.filter((item) => {
    const row = item as { platform?: string; id?: string; channelId?: string };
    return row.platform !== 'tiktok' && row.id !== 'tiktok' && typeof row.channelId === 'string';
  }) as Array<{
    id: string;
    channelId: string;
    name?: string;
    slug?: string;
    stats?: { subscriberCount?: number | null; hiddenSubscriberCount?: boolean };
  }>;

  if (!youtubeRemote.length) return null;

  const channels = current.channels.map((channel) => {
    const match = youtubeRemote.find((item) => item.channelId === channel.channelId);
    if (!match) return channel;
    return {
      ...channel,
      stats: {
        subscriberCount: match.stats?.subscriberCount ?? channel.stats.subscriberCount,
        hiddenSubscriberCount: match.stats?.hiddenSubscriberCount ?? channel.stats.hiddenSubscriberCount,
      },
    };
  });

  const combined = channels.reduce((sum, channel) => {
    const value = channel.stats.subscriberCount;
    return value == null ? sum : (sum ?? 0) + value;
  }, null as number | null);

  return {
    syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : current.syncedAt,
    syncOk: true,
    syncError: null,
    channels,
    combined,
    snapshots: {
      channelSnapshots: Array.isArray(data.channelSnapshots)
        ? (data.channelSnapshots as Payload['snapshots']['channelSnapshots'])
        : current.snapshots.channelSnapshots,
    },
  };
}

export function setupSubscriberBoard(): void {
  const section = document.querySelector('[data-subscriber-refresh]');
  const payloadNode = document.querySelector('#subscriber-payload');
  if (!(section instanceof HTMLElement) || !(payloadNode instanceof HTMLElement)) return;

  let payload: Payload;
  try {
    payload = JSON.parse(payloadNode.textContent || '{}') as Payload;
  } catch {
    return;
  }

  const period: Period = '7d';

  const render = () => {
    for (const channel of payload.channels) {
      const panel = section.querySelector(`[data-channel-panel="${channel.channelId}"]`);
      if (!(panel instanceof HTMLElement)) continue;
      const count = panel.querySelector('[data-sub-count]');
      const delta = panel.querySelector('[data-sub-delta]');
      const spark = panel.querySelector('[data-sub-spark]');
      const change = netChange(payload, channel.channelId, period);
      const series = seriesForChannel(payload, channel.channelId, period);
      const color = COLORS[channel.id] || '#d4b07a';

      if (count instanceof HTMLElement) count.textContent = formatNumber(channel.stats.subscriberCount);
      if (delta instanceof HTMLElement) {
        if (change == null) {
          delta.textContent = 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.';
          delta.classList.remove('is-up', 'is-down', 'is-flat');
        } else {
          delta.textContent = `${formatSigned(change)} ${periodLabel(period)}`;
          delta.classList.toggle('is-up', change > 0);
          delta.classList.toggle('is-down', change < 0);
          delta.classList.toggle('is-flat', change === 0);
        }
      }
      if (spark instanceof HTMLElement) spark.innerHTML = renderSpark(series, color);
    }
  };

  const refreshFromNetwork = async () => {
    try {
      const response = await fetch(`/data/community.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) return;
      const next = normalizeRemote(await response.json(), payload);
      if (!next) return;
      payload = next;
      payloadNode.textContent = JSON.stringify(next);
      render();
    } catch {
      return;
    }
  };

  window.setInterval(refreshFromNetwork, 60_000);
  const start = () => {
    void refreshFromNetwork();
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
