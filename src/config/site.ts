export const site = {
  name: 'Politik mit Kopf',
  url: 'https://web-developer89.github.io',
  locale: 'de-DE',
  description:
    'Ich habe eine abgeschlossene Ausbildung und jahrelange Berufserfahrung. Ich teile mein Wissen in Videos zu allen Themen, insbesondere Gesellschaft, Wirtschaft, Medien und Politik.',
  quote: 'Chancen multiplizieren sich, wenn man sie ergreift.',
  quoteAttribution: 'Sun Tzu',
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
