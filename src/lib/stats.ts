import type { ChannelPublicStats, ChannelSnapshot, SnapshotStore, VideoSnapshot } from '../types';
import snapshotsFile from '../data/snapshots.json';
import { catalog } from './catalog';

export type PeriodKey = '24h' | '7d' | '30d';
export type ChannelFilter = 'all' | string;

const PERIOD_MS: Record<PeriodKey, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const TOLERANCE_MS = 3 * 60 * 60 * 1000;

export const snapshots = snapshotsFile as SnapshotStore;

function emptyChannelStats(): ChannelPublicStats {
  return {
    subscriberCount: null,
    viewCount: null,
    videoCount: null,
    hiddenSubscriberCount: false,
  };
}

export function periodLabel(period: PeriodKey): string {
  if (period === '24h') return 'In den letzten 24 Stunden';
  if (period === '7d') return 'In den letzten 7 Tagen';
  return 'In den letzten 30 Tagen';
}

function closestBefore<T extends { at: string }>(items: T[], targetMs: number): T | null {
  let best: T | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const at = Date.parse(item.at);
    if (Number.isNaN(at) || at > targetMs + TOLERANCE_MS) continue;
    const delta = Math.abs(at - targetMs);
    if (delta < bestDelta) {
      best = item;
      bestDelta = delta;
    }
  }
  if (!best || bestDelta > PERIOD_MS['30d']) return null;
  return best;
}

function sumNullable(values: Array<number | null | undefined>): number | null {
  const usable = values.filter((value): value is number => typeof value === 'number');
  if (!usable.length) return null;
  return usable.reduce((sum, value) => sum + value, 0);
}

export function channelIdsForFilter(filter: ChannelFilter): string[] {
  if (filter === 'all') return catalog.channels.map((channel) => channel.channelId);
  const match = catalog.channels.find((channel) => channel.id === filter || channel.channelId === filter);
  return match ? [match.channelId] : [];
}

export function currentChannelTotals(filter: ChannelFilter = 'all'): ChannelPublicStats {
  const ids = new Set(channelIdsForFilter(filter));
  const channels = catalog.channels.filter((channel) => ids.has(channel.channelId));
  if (!channels.length) return emptyChannelStats();
  return {
    subscriberCount: sumNullable(channels.map((channel) => channel.stats?.subscriberCount ?? null)),
    viewCount: sumNullable(channels.map((channel) => channel.stats?.viewCount ?? null)),
    videoCount: sumNullable(channels.map((channel) => channel.stats?.videoCount ?? null)),
    hiddenSubscriberCount: channels.some((channel) => channel.stats?.hiddenSubscriberCount),
  };
}

export function currentVideoTotals(filter: ChannelFilter = 'all'): {
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
} {
  const ids = new Set(channelIdsForFilter(filter));
  const videos = catalog.videos.filter((video) => ids.has(video.channelId));
  return {
    viewCount: sumNullable(videos.map((video) => video.stats?.viewCount ?? null)),
    likeCount: sumNullable(videos.map((video) => video.stats?.likeCount ?? null)),
    commentCount: sumNullable(videos.map((video) => video.stats?.commentCount ?? null)),
  };
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return current - previous;
}

export type MetricBundle = {
  subscribers: { total: number | null; change: number | null; available: boolean };
  views: { total: number | null; change: number | null; available: boolean };
  likes: { total: number | null; change: number | null; available: boolean };
  comments: { total: number | null; change: number | null; available: boolean };
  insufficientHistory: boolean;
};

export function metricsFor(filter: ChannelFilter, period: PeriodKey): MetricBundle {
  const totals = currentChannelTotals(filter);
  const videoTotals = currentVideoTotals(filter);
  const ids = new Set(channelIdsForFilter(filter));
  const target = Date.now() - PERIOD_MS[period];

  const channelSnaps = (snapshots.channelSnapshots || []).filter((item) => ids.has(item.channelId));
  const videoSnaps = (snapshots.videoSnapshots || []).filter((item) => ids.has(item.channelId));

  const previousChannel: ChannelSnapshot[] = [];
  for (const channelId of ids) {
    const closest = closestBefore(
      channelSnaps.filter((item) => item.channelId === channelId),
      target,
    );
    if (closest) previousChannel.push(closest);
  }

  const previousVideoById = new Map<string, VideoSnapshot>();
  for (const videoId of new Set(videoSnaps.map((item) => item.videoId))) {
    const closest = closestBefore(
      videoSnaps.filter((item) => item.videoId === videoId),
      target,
    );
    if (closest) previousVideoById.set(videoId, closest);
  }

  const previousSubs = sumNullable(previousChannel.map((item) => item.subscriberCount));
  const previousChannelViews = sumNullable(previousChannel.map((item) => item.viewCount));
  const previousLikes = sumNullable([...previousVideoById.values()].map((item) => item.likeCount));
  const previousComments = sumNullable([...previousVideoById.values()].map((item) => item.commentCount));
  const previousVideoViews = sumNullable([...previousVideoById.values()].map((item) => item.viewCount));

  const hasChannelHistory = previousChannel.length > 0;
  const hasVideoHistory = previousVideoById.size > 0;

  return {
    subscribers: {
      total: totals.subscriberCount,
      change: delta(totals.subscriberCount, previousSubs),
      available: totals.subscriberCount != null,
    },
    views: {
      total: totals.viewCount ?? videoTotals.viewCount,
      change: delta(totals.viewCount ?? videoTotals.viewCount, previousChannelViews ?? previousVideoViews),
      available: (totals.viewCount ?? videoTotals.viewCount) != null,
    },
    likes: {
      total: videoTotals.likeCount,
      change: delta(videoTotals.likeCount, previousLikes),
      available: videoTotals.likeCount != null,
    },
    comments: {
      total: videoTotals.commentCount,
      change: delta(videoTotals.commentCount, previousComments),
      available: videoTotals.commentCount != null,
    },
    insufficientHistory: !hasChannelHistory && !hasVideoHistory,
  };
}

export function seriesFor(
  filter: ChannelFilter,
  metric: 'subscribers' | 'views' | 'likes' | 'comments',
  period: PeriodKey,
): Array<{ at: string; value: number }> {
  const ids = new Set(channelIdsForFilter(filter));
  const since = Date.now() - PERIOD_MS[period];
  const points = new Map<string, number>();

  if (metric === 'subscribers' || metric === 'views') {
    for (const snap of snapshots.channelSnapshots || []) {
      if (!ids.has(snap.channelId)) continue;
      const at = Date.parse(snap.at);
      if (Number.isNaN(at) || at < since) continue;
      const value = metric === 'subscribers' ? snap.subscriberCount : snap.viewCount;
      if (value == null) continue;
      points.set(snap.at, (points.get(snap.at) || 0) + value);
    }
  } else {
    for (const snap of snapshots.videoSnapshots || []) {
      if (!ids.has(snap.channelId)) continue;
      const at = Date.parse(snap.at);
      if (Number.isNaN(at) || at < since) continue;
      const value = metric === 'likes' ? snap.likeCount : snap.commentCount;
      if (value == null) continue;
      points.set(snap.at, (points.get(snap.at) || 0) + value);
    }
  }

  return [...points.entries()]
    .map(([at, value]) => ({ at, value }))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}
