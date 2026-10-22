import { catalog, videoPath } from './catalog';
import { connectedSocials } from '../config/social';

export type SearchItem = {
  href: string;
  title: string;
  kind: 'Video' | 'Seite';
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
    href: '/unsere-kanaele/',
    title: 'Meine Kanäle',
    kind: 'Seite',
    text: 'Politik mit Kopf REAGIERT YouTube Kanäle',
  },
  {
    href: '/politik-mit-kopf/',
    title: 'Politik mit Kopf',
    kind: 'Seite',
    text: 'Hauptkanal YouTube Analysen',
  },
  {
    href: '/politik-mit-kopf-reagiert/',
    title: 'Politik mit Kopf REAGIERT',
    kind: 'Seite',
    text: 'Reaktionskanal YouTube Reaktionen',
  },
  {
    href: '/aktuelles/',
    title: 'Aktuelles',
    kind: 'Seite',
    text: 'Neueste Veröffentlichungen Videos Livestream',
  },
  {
    href: '/informant-werden/',
    title: 'Informant werden',
    kind: 'Seite',
    text: 'Hinweise Unterlagen E-Mail Post Diskretion',
  },
  {
    href: '/beratungsgespraech/',
    title: 'Beratungsgespräch',
    kind: 'Seite',
    text: 'Beratung Anfrage Zusammenarbeit kontakt@politikmitkopf.de',
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
    href: '/impressum/',
    title: 'Impressum',
    kind: 'Seite',
    text: 'MK Swiss Media GmbH Impressum Einsiedeln kontakt@politikmitkopf.de',
  },
  {
    href: '/datenschutz/',
    title: 'Datenschutz',
    kind: 'Seite',
    text: 'Datenschutz YouTube',
  },
];

export function searchIndex(): SearchItem[] {
  const videos: SearchItem[] = catalog.videos.map((video) => ({
    href: videoPath(video),
    title: video.title,
    kind: 'Video',
    date: video.publishedAt,
    text: `${video.title} ${video.excerpt} ${video.description} ${video.channelName} ${video.tags.join(' ')}`.slice(0, 700),
  }));
  return [...videos, ...pages];
}

export function searchContent(query: string, limit = 24): SearchItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return searchIndex()
    .filter((item) => item.title.toLowerCase().includes(needle) || item.text.toLowerCase().includes(needle))
    .slice(0, limit);
}
