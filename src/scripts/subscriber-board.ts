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
  const height = 56;
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
      <polyline fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${coords.join(' ')}"></polyline>
    </svg>
  `;
}

function renderComparisonChart(
  channels: Array<{ id: string; name: string; series: Array<{ at: string; value: number }> }>,
): string {
  const usable = channels.filter((channel) => channel.series.length >= 2);
  if (!usable.length) {
    return `<p class="growth-note">Für diesen Zeitraum liegen noch nicht genügend Daten vor.</p>`;
  }

  const width = 720;
  const height = 280;
  const pad = { top: 24, right: 18, bottom: 36, left: 64 };
  const allValues = usable.flatMap((channel) => channel.series.map((point) => point.value));
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 1);
  const allTimes = usable.flatMap((channel) => channel.series.map((point) => Date.parse(point.at)));
  const tMin = Math.min(...allTimes);
  const tMax = Math.max(...allTimes);
  const tSpan = Math.max(tMax - tMin, 1);

  const xOf = (iso: string) => pad.left + ((Date.parse(iso) - tMin) / tSpan) * (width - pad.left - pad.right);
  const yOf = (value: number) => pad.top + (1 - (value - min) / span) * (height - pad.top - pad.bottom);

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const value = min + span * (1 - ratio);
    const y = pad.top + ratio * (height - pad.top - pad.bottom);
    return `
      <line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.08)" />
      <text x="${pad.left - 10}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#9BA7B5" font-size="11">${formatNumber(Math.round(value))}</text>
    `;
  });

  const paths = usable.map((channel) => {
    const color = COLORS[channel.id] || '#d4b07a';
    const points = channel.series.map((point) => `${xOf(point.at).toFixed(1)},${yOf(point.value).toFixed(1)}`).join(' ');
    const last = channel.series[channel.series.length - 1];
    return `
      <polyline fill="none" stroke="${color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline>
      <circle cx="${xOf(last.at).toFixed(1)}" cy="${yOf(last.value).toFixed(1)}" r="3.5" fill="${color}"></circle>
    `;
  });

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Vergleich der Abonnentenentwicklung">
      ${gridLines.join('')}
      ${paths.join('')}
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

  let period: Period = '7d';
  let delayed = false;

  const combinedNode = section.querySelector('[data-combined-count]');
  const chartRoot = section.querySelector('[data-dev-chart]');
  const caption = section.querySelector('[data-dev-caption]');
  const legend = section.querySelector('[data-dev-legend]');

  const render = () => {
    if (combinedNode instanceof HTMLElement) {
      combinedNode.textContent = formatNumber(payload.combined);
    }

    for (const channel of payload.channels) {
      const panel = section.querySelector(`[data-channel-panel="${channel.channelId}"]`);
      if (!(panel instanceof HTMLElement)) continue;
      const count = panel.querySelector('[data-sub-count]');
      const delta = panel.querySelector('[data-sub-delta]');
      const spark = panel.querySelector('[data-sub-spark]');
      const stamp = panel.querySelector('[data-sub-stamp]');
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
      if (stamp instanceof HTMLElement) {
        if (payload.syncedAt && !delayed) {
          stamp.innerHTML = `Zuletzt aktualisiert: <time datetime="${payload.syncedAt}">${formatStamp(payload.syncedAt)}</time>`;
        } else if (payload.syncedAt) {
          stamp.innerHTML = `Aktualisierung verzögert – letzter verfügbarer Stand: <time datetime="${payload.syncedAt}">${formatStamp(payload.syncedAt)}</time>`;
        } else {
          stamp.textContent = 'Noch keine erfolgreiche Synchronisierung';
        }
      }
    }

    const chartSeries = payload.channels.map((channel) => ({
      id: channel.id,
      name: channel.name,
      series: seriesForChannel(payload, channel.channelId, period),
    }));

    if (chartRoot instanceof HTMLElement) {
      chartRoot.innerHTML = renderComparisonChart(chartSeries);
    }

    if (legend instanceof HTMLElement) {
      legend.innerHTML = payload.channels
        .map((channel) => {
          const color = COLORS[channel.id] || '#d4b07a';
          return `<li><span style="background:${color}"></span>${channel.name}</li>`;
        })
        .join('');
    }

    if (caption instanceof HTMLElement) {
      const ready = chartSeries.every((channel) => channel.series.length >= 2);
      caption.textContent = ready
        ? `Öffentliche YouTube-Abonnentenzahlen · ${periodLabel(period)}`
        : 'Für diesen Zeitraum liegen noch nicht genügend Daten vor.';
    }
  };

  section.querySelectorAll<HTMLButtonElement>('[data-period]').forEach((button) => {
    button.addEventListener('click', () => {
      period = (button.dataset.period as Period) || '7d';
      section.querySelectorAll('[data-period]').forEach((node) => node.classList.toggle('is-active', node === button));
      render();
    });
  });

  const refreshFromNetwork = async () => {
    try {
      const response = await fetch(`/data/stats.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) {
        delayed = true;
        render();
        return;
      }
      const next = normalizeRemote(await response.json(), payload);
      if (!next) {
        delayed = true;
        render();
        return;
      }
      delayed = false;
      payload = next;
      payloadNode.textContent = JSON.stringify(next);
      render();
    } catch {
      delayed = true;
      render();
    }
  };

  render();
  window.setInterval(refreshFromNetwork, 60_000);
}
