export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Zurich',
  }).format(date);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Zurich',
  }).format(date);
}

export function formatNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('de-DE').format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('de-DE', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatSignedNumber(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export type TextPart = { type: 'text' | 'link'; value: string; href?: string };

/** Channel landing URLs get YouTube's subscribe confirmation popup. Watch/shorts stay untouched. */
export function withYouTubeSubscribeConfirmation(href: string): string {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^(www|m)\./, '');
    if (host !== 'youtube.com') return href;
    const path = url.pathname;
    const isChannel =
      path.startsWith('/@') ||
      path.startsWith('/channel/') ||
      path.startsWith('/c/') ||
      path.startsWith('/user/');
    if (!isChannel) return href;
    if (url.searchParams.get('sub_confirmation') === '1') return href;
    url.searchParams.set('sub_confirmation', '1');
    return url.toString();
  } catch {
    return href;
  }
}

export function linkify(line: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /https?:\/\/[^\s]+/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', value: line.slice(last, start) });
    const raw = match[0];
    const cleaned = raw.replace(/[),.;]+$/g, '');
    const href = withYouTubeSubscribeConfirmation(cleaned);
    const trailing = raw.slice(cleaned.length);
    parts.push({ type: 'link', value: href, href });
    if (trailing) parts.push({ type: 'text', value: trailing });
    last = start + raw.length;
  }
  if (last < line.length) parts.push({ type: 'text', value: line.slice(last) });
  return parts.length ? parts : [{ type: 'text', value: line }];
}

export function descriptionLines(description: string): string[] {
  return description.split(/\n/).map((line) => line.trimEnd());
}
