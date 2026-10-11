export type SocialLink = {
  id: string;
  label: string;
  href: string;
  description: string;
  connected: boolean;
  prominence?: 'channel' | 'standard';
};

export const socials: SocialLink[] = [
  {
    id: 'youtube',
    label: 'YouTube · Politik mit Kopf',
    href: 'https://www.youtube.com/channel/UCsLN1bEfDJoZOs8udTwHatQ?sub_confirmation=1',
    description: 'Der Hauptkanal mit Analysen und aktuellen Beiträgen.',
    connected: true,
    prominence: 'channel',
  },
  {
    id: 'youtube-reagiert',
    label: 'YouTube · REAGIERT',
    href: 'https://www.youtube.com/@PolitikmitKopfReagiert?sub_confirmation=1',
    description: 'Der Kanal für Reaktionsvideos und längere Einordnungen.',
    connected: true,
    prominence: 'channel',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: 'https://t.me/politik_mit_kopf',
    description: 'Neue Veröffentlichungen direkt verfolgen.',
    connected: true,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: 'https://whatsapp.com/channel/0029Vb822FVBadmbHAN3mg0L',
    description: 'Der Kanal für Hinweise auf neue Beiträge.',
    connected: true,
  },
  {
    id: 'x',
    label: 'X',
    href: 'https://x.com/Politikmit_Kopf',
    description: 'Kurze Hinweise und Verweise auf neue Videos.',
    connected: true,
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
    label: 'TikTok',
    href: '',
    description: '',
    connected: false,
  },
];

export const connectedSocials = socials.filter((item) => item.connected && item.href);
export const channelSocials = connectedSocials.filter((item) => item.prominence === 'channel');
export const standardSocials = connectedSocials.filter((item) => item.prominence !== 'channel');

export const shareTargets = ['copy', 'native', 'x', 'telegram', 'whatsapp'] as const;
