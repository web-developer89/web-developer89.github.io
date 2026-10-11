export const site = {
  name: 'Politik mit Kopf',
  url: 'https://web-developer89.github.io',
  locale: 'de-DE',
  description:
    'Politik mit Kopf ist die unabhängige Medienplattform für Analysen, Einordnungen und Reaktionsvideos zu Politik, Gesellschaft, Wirtschaft und Medien.',
  quote: 'Chancen multiplizieren sich, wenn man sie ergreift.',
  quoteAttribution: 'Sun Tzu',
  contactEmail: 'kontakt@politikmitkopf.de',
  analytics: {
    enabled: false,
    provider: null as null | 'matomo' | 'plausible',
  },
  newsletter: {
    enabled: false,
    provider: null as null | string,
  },
  publisher: {
    legalName: 'MK Swiss Media GmbH',
    street: 'Zürichstrasse 38A',
    postalCode: '8840',
    city: 'Einsiedeln',
    country: 'Schweiz',
    countryCode: 'CH',
    registerCourt: 'Handelsregisteramt Kanton Schwyz',
    registerNumber: 'CHE-192.112.908',
  },
} as const;

export const publisherLines = [
  site.publisher.legalName,
  site.publisher.street,
  `${site.publisher.postalCode} ${site.publisher.city}`,
  site.publisher.country,
];
