export type SocialLink = {
  id: string;
  label: string;
  href: string;
  description: string;
  connected: boolean;
};

export const socials: SocialLink[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    href: 'https://www.youtube.com/@PolitikmitKopf',
    description: 'Videos, Analysen und aktuelle Beiträge.',
    connected: true,
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

export const shareTargets = ['copy', 'native', 'x', 'telegram', 'whatsapp'] as const;
