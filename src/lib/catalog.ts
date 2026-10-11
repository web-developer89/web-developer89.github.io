import catalogFile from '../data/catalog.json';
import feedFile from '../data/feed.json';
import youtubeConfig from '../config/youtube.json';
import tiktokConfig from '../config/tiktok.json';
import { topics } from '../config/topics';
import type { Catalog, CatalogChannel, Feed, TikTokChannel, Video } from '../types';

function normalizeCatalog(raw: Catalog): Catalog {
  return {
    ...raw,
    channels: (raw.channels || []).map((channel) => ({
      ...channel,
      stats: channel.stats || {
        subscriberCount: null,
        viewCount: null,
        videoCount: null,
        hiddenSubscriberCount: false,
      },
    })),
    videos: (raw.videos || []).map((video) => ({
      ...video,
      stats: video.stats || {
        viewCount: null,
        likeCount: null,
        commentCount: null,
      },
    })),
    tiktok: raw.tiktok
      ? {
          ...raw.tiktok,
          stats: raw.tiktok.stats || {
            followerCount: null,
            likeCount: null,
            videoCount: null,
          },
        }
      : null,
  };
}

export const catalog = normalizeCatalog(catalogFile as Catalog);
export const feed = feedFile as Feed;

export type ChannelConfig = (typeof youtubeConfig.channels)[number];

export const youtube = youtubeConfig;
export const tiktok = tiktokConfig;

export function getTikTok(): TikTokChannel | null {
  if (catalog.tiktok) return catalog.tiktok;
  if (!tiktokConfig.enabled) return null;
  return {
    id: tiktokConfig.id,
    name: tiktokConfig.name,
    handle: tiktokConfig.handle,
    uniqueId: tiktokConfig.uniqueId,
    profileUrl: tiktokConfig.profileUrl,
    description: tiktokConfig.description,
    avatar: tiktokConfig.avatar,
    status: 'verbunden',
    stats: {
      followerCount: null,
      likeCount: null,
      videoCount: null,
    },
  };
}

export function videoPath(video: Pick<Video, 'slug'>): string {
  return `/videos/${video.slug}/`;
}

/** Every outbound YouTube channel link must open the subscribe confirmation dialog. */
export function youtubeSubscribeUrl(channel: {
  subscribeUrl?: string | null;
  channelUrl?: string | null;
  channelId?: string | null;
}): string {
  if (channel.subscribeUrl?.includes('sub_confirmation=1')) return channel.subscribeUrl;
  if (channel.channelId) {
    return `https://www.youtube.com/channel/${channel.channelId}?sub_confirmation=1`;
  }
  const base = (channel.channelUrl || 'https://www.youtube.com/@PolitikmitKopf')
    .replace(/\/$/, '')
    .replace(/\?.*$/, '');
  return `${base}?sub_confirmation=1`;
}

export function subscribeUrlForVideo(video: Pick<Video, 'channelId'>): string {
  const fromConfig = youtube.channels.find((channel) => channel.channelId === video.channelId);
  if (fromConfig) return youtubeSubscribeUrl(fromConfig);
  return youtubeSubscribeUrl({ channelId: video.channelId });
}

export function getFeatured(): Video | null {
  if (youtube.featuredMode === 'manual' && youtube.featuredVideoId) {
    const chosen = catalog.videos.find((video) => video.id === youtube.featuredVideoId);
    if (chosen) return chosen;
  }
  return catalog.videos[0] ?? null;
}

export function channelDirectory(): Array<
  ChannelConfig & {
    videoCount: number;
    status: CatalogChannel['status'];
    latest: Video | null;
    stats: CatalogChannel['stats'];
  }
> {
  return [...youtube.channels]
    .filter((channel) => channel.enabled)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((channel) => {
      const stat = catalog.channels.find((item) => item.channelId === channel.channelId);
      const latest = catalog.videos.find((video) => video.channelId === channel.channelId) ?? null;
      return {
        ...channel,
        videoCount: stat?.videoCount ?? catalog.videos.filter((video) => video.channelId === channel.channelId).length,
        status: stat?.status ?? 'verbunden',
        latest,
        stats: stat?.stats || {
          subscriberCount: null,
          viewCount: null,
          videoCount: null,
          hiddenSubscriberCount: false,
        },
      };
    });
}

export function channelBySlug(slug: string) {
  return channelDirectory().find((channel) => channel.slug === slug) ?? null;
}

export function allChannelDirectory() {
  return [...youtube.channels]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((channel) => {
      const stat = catalog.channels.find((item) => item.channelId === channel.channelId);
      return {
        ...channel,
        videoCount: stat?.videoCount ?? 0,
        status: channel.enabled ? (stat?.status ?? 'verbunden') : ('deaktiviert' as const),
      };
    });
}

export function videosForTopic(slug: string): Video[] {
  const topic = topics.find((item) => item.slug === slug);
  if (!topic) return [];
  const keys = new Set(topic.match.map((item) => item.toLowerCase()));
  return catalog.videos.filter((video) => video.tags.some((tag) => keys.has(tag.toLowerCase())));
}

export function relatedVideos(video: Video, limit = 3): Video[] {
  return catalog.videos.filter((item) => item.id !== video.id && item.channelId === video.channelId).slice(0, limit);
}

export function uniqueTags(): string[] {
  const tags = new Set<string>();
  for (const video of catalog.videos) {
    for (const tag of video.tags) tags.add(tag);
  }
  return [...tags].sort((a, b) => a.localeCompare(b, 'de'));
}

export function uniqueYears(): string[] {
  const years = new Set<string>();
  for (const video of catalog.videos) years.add(video.publishedAt.slice(0, 4));
  return [...years].sort((a, b) => Number(b) - Number(a));
}
