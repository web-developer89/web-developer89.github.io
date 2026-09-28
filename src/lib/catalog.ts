import catalogFile from '../data/catalog.json';
import feedFile from '../data/feed.json';
import youtubeConfig from '../config/youtube.json';
import { topics } from '../config/topics';
import type { Catalog, CatalogChannel, Feed, Video } from '../types';

export const catalog = catalogFile as Catalog;
export const feed = feedFile as Feed;

export type ChannelConfig = (typeof youtubeConfig.channels)[number];

export const youtube = youtubeConfig;

export function videoPath(video: Pick<Video, 'slug'>): string {
  return `/videos/${video.slug}/`;
}

export function getFeatured(): Video | null {
  if (youtube.featuredMode === 'manual' && youtube.featuredVideoId) {
    const chosen = catalog.videos.find((video) => video.id === youtube.featuredVideoId);
    if (chosen) return chosen;
  }
  return catalog.videos[0] ?? null;
}

export function channelDirectory(): Array<
  ChannelConfig & { videoCount: number; status: CatalogChannel['status']; latest: Video | null }
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
      };
    });
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
