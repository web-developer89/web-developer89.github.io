/** Optional first-party analytics hook. No third-party tracking by default. */
export function track(_event: string, _payload?: Record<string, unknown>): void {
  // Intentionally empty unless site.analytics.enabled is wired later.
}
