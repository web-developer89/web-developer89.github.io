import youtube from './youtube.json';

export type SocialLink = {
  id: string;
  label: string;
  href: string;
  /** Clean profile URL for schema.org sameAs (no subscribe popup query). */
  profileUrl?: string;
  description: string;
  connected: boolean;
  prominence?: 'channel' | 'standard';
  /** Custom brand badge under /public/brand/channels */
  badge?: string;
};

const primary = youtube.channels.find((channel) => channel.id === 'primary')!;
const reagiert = youtube.channels.find((channel) => channel.id === 'reagiert')!;

export const socials: SocialLink[] = [
  {
    id: 'youtube',
    label: 'YouTube · Politik mit Kopf',
    href: primary.subscribeUrl,
    profileUrl: primary.channelUrl,
    description: 'Der Hauptkanal mit Analysen und aktuellen Beiträgen.',
    connected: true,
    prominence: 'channel',
    badge: '/brand/channels/youtube.png',
  },
  {
    id: 'youtube-reagiert',
    label: 'YouTube · REAGIERT',
    href: reagiert.subscribeUrl,
    profileUrl: reagiert.channelUrl,
    description: 'Der Kanal für Reaktionsvideos und längere Einordnungen.',
    connected: true,
    prominence: 'channel',
    badge: '/brand/channels/youtube.png',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: 'https://t.me/politik_mit_kopf',
    description: 'Neue Veröffentlichungen direkt verfolgen.',
    connected: true,
    badge: '/brand/channels/telegram.png',
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://whatsapp.com/channel/0029Vb822FVBadmbHAN3mg0L',
    description: 'Der Kanal für Hinweise auf neue Beiträge.',
    connected: true,
    badge: '/brand/channels/whatsapp.png',
  },
  {
    id: 'x',
    label: 'X',
    href: 'https://x.com/Politikmit_Kopf',
    description: 'Kurze Hinweise und Verweise auf neue Videos.',
    connected: true,
    badge: '/brand/channels/x.png',
  },
  {
    id: 'instagram',
    label: 'Instagram',
    href: '',
    description: '',
    connected: false,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: '',
    description: '',
    connected: false,
  },
  {
    id: 'tiktok',
    label: 'TikTok · Politik mit Kopf',
    href: 'https://www.tiktok.com/@politik.mit.kopf',
    profileUrl: 'https://www.tiktok.com/@politik.mit.kopf',
    description: 'Kurze Clips und Hinweise zum YouTube-Kanal.',
    connected: true,
    prominence: 'channel',
    badge: '/brand/channels/tiktok.png',
  },
];

export const connectedSocials = socials.filter((item) => item.connected && item.href);
export const channelSocials = connectedSocials.filter((item) => item.prominence === 'channel');
export const standardSocials = connectedSocials.filter((item) => item.prominence !== 'channel');

/** One badge per platform image (YouTube once, then the other channels). */
export const badgeSocials = (() => {
  const order = ['youtube', 'tiktok', 'telegram', 'whatsapp', 'x'] as const;
  return order
    .map((id) => connectedSocials.find((item) => item.id === id && item.badge))
    .filter((item): item is SocialLink => Boolean(item));
})();

export const shareTargets = ['copy', 'native', 'x', 'telegram', 'whatsapp'] as const;
