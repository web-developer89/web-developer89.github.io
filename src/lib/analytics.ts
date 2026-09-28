import { site } from '../config/site';

export function track(event: string, props?: Record<string, string>): void {
  if (!site.analytics.enabled || !site.analytics.provider) return;
  const detail = { event, props, provider: site.analytics.provider };
  document.dispatchEvent(new CustomEvent('pmk-analytics', { detail }));
}
