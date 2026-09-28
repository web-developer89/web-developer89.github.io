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
};

export type CatalogChannel = {
  id: string;
  channelId: string;
  name: string;
  videoCount: number;
  status: 'verbunden' | 'deaktiviert' | 'fehler';
  avatar: string;
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
  } | null;
  message: {
    headline: string;
    ticker: string;
    custom: string;
  };
};
