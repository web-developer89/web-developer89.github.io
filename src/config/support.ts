export const support = {
  intro: 'Du möchtest die Arbeit von Politik mit Kopf unterstützen?',
  bank: {
    enabled: true,
    accountName: 'MK Swiss Media GmbH',
    iban: 'CH42 0077 7009 8834 0181 6',
    currencyNote: 'Euro-Konto',
    purpose: 'Spende',
  },
  links: [] as { label: string; href: string }[],
  recommendations: [
    {
      title: 'Amazon-Shop',
      href: 'https://amzn.eu/d/0gPb9Zmz',
      note: 'Produkte, die im Kanal empfohlen werden.',
    },
    {
      title: 'Tesla-Empfehlungslink',
      href: 'https://ts.la/maurice669555',
      note: '1000 Freikilometer am Supercharger, wenn über den Empfehlungslink bestellt wird.',
    },
  ],
  disclaimer: 'Werbung / Affiliate-Link. Als Partner verdiene ich an qualifizierten Käufen.',
} as const;

export const contactCategories = [
  'Allgemeine Anfrage',
  'Presse',
  'Kooperation',
  'Technik',
  'Sonstiges',
] as const;
