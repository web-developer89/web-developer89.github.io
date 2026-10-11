export type BankAccount = {
  enabled: boolean;
  accountName: string;
  iban: string;
  currencyNote: string;
  purpose: string;
  city?: string;
};

export const support = {
  intro: 'Du möchtest die Arbeit von Politik mit Kopf unterstützen?',
  banks: [
    {
      enabled: true,
      accountName: 'MK Swiss Media GmbH',
      iban: 'CH42 0077 7009 8834 0181 6',
      currencyNote: 'Euro-Konto',
      purpose: 'Spende',
    },
    {
      enabled: true,
      accountName: 'MK Swiss Media GmbH',
      iban: 'CH15 0077 7009 8834 0191 4',
      currencyNote: 'CHF-Konto',
      purpose: 'Spende',
    },
  ] satisfies BankAccount[],
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
