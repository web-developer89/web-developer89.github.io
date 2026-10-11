export type VideoStats = {
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

export type Video = {
  id: string;
  slug: string;
  channelId: string;
  channelName: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  url: string;
  thumbnail: string;
  thumbnailRemote: string;
  durationLabel: string | null;
  tags: string[];
  stats: VideoStats;
};

export type ChannelPublicStats = {
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
  hiddenSubscriberCount: boolean;
};

export type CatalogChannel = {
  id: string;
  channelId: string;
  name: string;
  videoCount: number;
  status: 'verbunden' | 'deaktiviert' | 'fehler';
  avatar: string;
  slug?: string;
  handle?: string;
  channelUrl?: string;
  stats: ChannelPublicStats;
};

export type LiveItem = {
  videoId: string;
  title: string;
  channelId: string;
  channelName: string;
  url: string;
  thumbnail: string;
  thumbnailRemote: string;
};

export type Catalog = {
  syncedAt: string | null;
  ok: boolean;
  source: 'rss' | 'youtube-data-api' | 'mixed' | 'none';
  error: string | null;
  live: LiveItem | null;
  channels: CatalogChannel[];
  videos: Video[];
};

export type Feed = {
  syncedAt: string | null;
  live: LiveItem | null;
  latest: {
    title: string;
    url: string;
    pageUrl: string;
    thumbnail: string;
    publishedAt: string;
    channelId?: string;
    channelName?: string;
  } | null;
  channels: Array<{
    id: string;
    channelId: string;
    name: string;
    slug: string;
    stats: ChannelPublicStats;
  }>;
  message: {
    headline: string;
    ticker: string;
    custom: string;
  };
};

export type ChannelSnapshot = {
  at: string;
  channelId: string;
  subscriberCount: number | null;
  viewCount: number | null;
  videoCount: number | null;
};

export type VideoSnapshot = {
  at: string;
  videoId: string;
  channelId: string;
  viewCount: number | null;
  likeCount: number | null;
  commentCount: number | null;
};

export type SnapshotStore = {
  timezone: 'Europe/Zurich';
  channelSnapshots: ChannelSnapshot[];
  videoSnapshots: VideoSnapshot[];
};
