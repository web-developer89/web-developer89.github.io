export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
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
    timeZone: 'Europe/Berlin',
  }).format(date);
}

export function currentYear(): number {
  return new Date().getFullYear();
}

export type TextPart = { type: 'text' | 'link'; value: string; href?: string };

export function linkify(line: string): TextPart[] {
  const parts: TextPart[] = [];
  const pattern = /https?:\/\/[^\s]+/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', value: line.slice(last, start) });
    const raw = match[0];
    const href = raw.replace(/[),.;]+$/g, '');
    const trailing = raw.slice(href.length);
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
