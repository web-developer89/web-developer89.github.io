import { catalog, videoPath } from './catalog';
import { topics } from '../config/topics';
import { connectedSocials } from '../config/social';

export type SearchItem = {
  href: string;
  title: string;
  kind: 'Video' | 'Thema' | 'Seite';
  text: string;
  date?: string;
};

const pages: SearchItem[] = [
  {
    href: '/videos/',
    title: 'Videos',
    kind: 'Seite',
    text: 'Videothek Archiv Beiträge durchsuchen',
  },
  {
    href: '/aktuelles/',
    title: 'Aktuelles',
    kind: 'Seite',
    text: 'Neueste Veröffentlichungen Videos Livestream',
  },
  {
    href: '/themen/',
    title: 'Themen',
    kind: 'Seite',
    text: 'Gesellschaft Wirtschaft Medien Politik',
  },
  {
    href: '/ueber-uns/',
    title: 'Über uns',
    kind: 'Seite',
    text: 'Politik mit Kopf Projekt Kanal Beschreibung',
  },
  {
    href: '/social-media/',
    title: 'Social Media',
    kind: 'Seite',
    text: connectedSocials.map((item) => item.label).join(' '),
  },
  {
    href: '/unterstuetzen/',
    title: 'Projekt unterstützen',
    kind: 'Seite',
    text: 'Spende Unterstützung IBAN',
  },
  {
    href: '/kontakt/',
    title: 'Kontakt',
    kind: 'Seite',
    text: 'Kontakt Anfrage Presse Kooperation',
  },
  {
    href: '/impressum/',
    title: 'Impressum',
    kind: 'Seite',
    text: 'MK Swiss Media GmbH Impressum Einsiedeln',
  },
  {
    href: '/datenschutz/',
    title: 'Datenschutz',
    kind: 'Seite',
    text: 'Datenschutz localStorage YouTube',
  },
];

export function searchIndex(): SearchItem[] {
  const videos: SearchItem[] = catalog.videos.map((video) => ({
    href: videoPath(video),
    title: video.title,
    kind: 'Video',
    date: video.publishedAt,
    text: `${video.title} ${video.excerpt} ${video.description} ${video.tags.join(' ')}`.slice(0, 700),
  }));
  const topicItems: SearchItem[] = topics.map((topic) => ({
    href: `/themen/${topic.slug}/`,
    title: topic.title,
    kind: 'Thema',
    text: `${topic.title} Gesellschaft Wirtschaft Medien Politik`,
  }));
  return [...videos, ...topicItems, ...pages];
}

export function searchContent(query: string, limit = 24): SearchItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return searchIndex()
    .filter((item) => item.title.toLowerCase().includes(needle) || item.text.toLowerCase().includes(needle))
    .slice(0, limit);
}
