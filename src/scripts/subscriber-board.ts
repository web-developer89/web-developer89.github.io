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

function comparison(payload: Payload, channelId: string, period: Period): { change: number; label: string } | null {
  const current = payload.channels.find((channel) => channel.channelId === channelId)?.stats.subscriberCount ?? null;
  const snaps = (payload.snapshots.channelSnapshots || []).filter((item) => item.channelId === channelId && item.subscriberCount != null);
  const target = Date.now() - PERIOD_MS[period];
  const anchored = closestBefore(snaps, target);
  const earliest = [...snaps].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).find((item) => Date.parse(item.at) >= target);
  const baseline = anchored?.subscriberCount != null ? anchored : earliest ?? null;
  if (current == null || baseline?.subscriberCount == null) return null;
  const started = Date.parse(baseline.at);
  const near = Number.isFinite(started) && Math.abs(started - target) <= 36 * 60 * 60 * 1000;
  const label = near
    ? periodLabel(period)
    : `seit dem ${new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long', timeZone: 'Europe/Zurich' }).format(new Date(started))}`;
  return { change: current - baseline.subscriberCount, label };
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

  const remoteSyncedAt = typeof data.syncedAt === 'string' ? data.syncedAt : '';
  const remoteTime = Date.parse(remoteSyncedAt);
  if (!remoteSyncedAt || Number.isNaN(remoteTime)) return null;
  if (current.syncedAt && remoteTime < Date.parse(current.syncedAt)) return null;

  const channels = current.channels.map((channel) => {
    const match = youtubeRemote.find((item) => item.channelId === channel.channelId);
    if (!match) return channel;
    const incoming = match.stats?.subscriberCount;
    const previous = channel.stats.subscriberCount;
    const subscriberCount =
      typeof incoming === 'number' && Number.isFinite(incoming) && !(incoming === 0 && (previous ?? 0) > 0)
        ? incoming
        : previous;
    return {
      ...channel,
      stats: {
        subscriberCount,
        hiddenSubscriberCount: match.stats?.hiddenSubscriberCount ?? channel.stats.hiddenSubscriberCount,
      },
    };
  });

  const combined = channels.reduce((sum, channel) => {
    const value = channel.stats.subscriberCount;
    return value == null ? sum : (sum ?? 0) + value;
  }, null as number | null);

  return {
    syncedAt: remoteSyncedAt || current.syncedAt,
    syncOk: true,
    syncError: null,
    channels,
    combined,
    snapshots: {
      channelSnapshots: Array.isArray(data.channelSnapshots) && data.channelSnapshots.length
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

  const movement = (channelId: string): { change: number; label: string; period: Period } | null => {
    const week = comparison(payload, channelId, '7d');
    if (week && week.change !== 0) return { ...week, period: '7d' };
    const month = comparison(payload, channelId, '30d');
    if (month && month.change !== 0) return { ...month, period: '30d' };
    if (week?.change === 0 || month?.change === 0) return { change: 0, label: '', period: '7d' };
    return null;
  };

  const render = () => {
    for (const channel of payload.channels) {
      const panel = section.querySelector(`[data-channel-panel="${channel.channelId}"]`);
      if (!(panel instanceof HTMLElement)) continue;
      const count = panel.querySelector('[data-sub-count]');
      const delta = panel.querySelector('[data-sub-delta]');
      const spark = panel.querySelector('[data-sub-spark]');
      const shown = movement(channel.channelId);
      const series = seriesForChannel(payload, channel.channelId, shown?.period ?? '7d');
      const color = COLORS[channel.id] || '#d4b07a';

      if (count instanceof HTMLElement && channel.stats.subscriberCount != null) {
        count.textContent = formatNumber(channel.stats.subscriberCount);
      }
      if (delta instanceof HTMLElement) {
        if (shown == null) {
          delta.hidden = false;
          delta.textContent = 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.';
          delta.classList.remove('is-up', 'is-down', 'is-flat');
        } else if (shown.change === 0) {
          delta.hidden = true;
          delta.textContent = '';
          delta.classList.remove('is-up', 'is-down', 'is-flat');
        } else {
          delta.hidden = false;
          delta.textContent = `${formatSigned(shown.change)} ${shown.label}`;
          delta.classList.toggle('is-up', shown.change > 0);
          delta.classList.toggle('is-down', shown.change < 0);
          delta.classList.remove('is-flat');
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
