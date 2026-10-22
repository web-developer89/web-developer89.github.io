export const navigation = [
  { href: '/', label: 'Startseite' },
  { href: '/videos/', label: 'Videos' },
  { href: '/unsere-kanaele/', label: 'Meine Kanäle' },
  { href: '/informant-werden/', label: 'Informant werden' },
  { href: '/unterstuetzen/', label: 'Unterstützen' },
] as const;

export const primaryCta = {
  href: '/beratungsgespraech/',
  label: 'Beratung buchen',
} as const;

export const footerDiscover = [
  { href: '/videos/', label: 'Videos' },
  { href: '/unsere-kanaele/', label: 'Meine Kanäle' },
  { href: '/aktuelles/', label: 'Aktuelles' },
  { href: '/suche/', label: 'Suche' },
] as const;

export const footerProject = [
  { href: '/ueber-uns/', label: 'Über uns' },
  { href: '/informant-werden/', label: 'Informant werden' },
  { href: '/beratungsgespraech/', label: 'Beratungsgespräch' },
  { href: '/unterstuetzen/', label: 'Unterstützen' },
  { href: '/redaktion/', label: 'Synchronisation' },
] as const;

export const footerLegal = [
  { href: '/impressum/', label: 'Impressum' },
  { href: '/datenschutz/', label: 'Datenschutz' },
] as const;
