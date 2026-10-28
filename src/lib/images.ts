/** Widths offered for 16:9 video stills. */
export const PHOTO_WIDTHS = [480, 768, 1280] as const;

export function supportsAvif(src: string): boolean {
  return /\.jpe?g$/i.test(src);
}

export function optimizedSrc(src: string, width: number, ext: 'avif' | 'webp'): string {
  const stem = src.replace(/^\//, '').replace(/\.[a-z0-9]+$/i, '');
  return `/optimized/${stem}-${width}.${ext}`;
}

export function buildSrcSet(src: string, widths: readonly number[], ext: 'avif' | 'webp'): string {
  return widths.map((width) => `${optimizedSrc(src, width, ext)} ${width}w`).join(', ');
}
