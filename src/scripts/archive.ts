export function setupArchive(): void {
  const root = document.querySelector('[data-archive]');
  if (!(root instanceof HTMLElement)) return;
  const grid = root.querySelector('[data-archive-grid]');
  const empty = root.querySelector('[data-archive-empty]');
  const count = root.querySelector('[data-archive-count]');
  const more = root.querySelector('[data-archive-more]');
  const query = root.querySelector('[name="q"]');
  const theme = root.querySelector('[name="thema"]');
  const year = root.querySelector('[name="jahr"]');
  const sort = root.querySelector('[name="sort"]');
  if (!(grid instanceof HTMLElement) || !(query instanceof HTMLInputElement)) return;

  let shown = Math.max(1, Number(new URLSearchParams(window.location.search).get('seite') || '1')) * 12;
  const cards = () => [...grid.querySelectorAll<HTMLElement>('[data-video]')];

  const apply = (updateUrl: boolean) => {
    const needle = query.value.trim().toLowerCase();
    const selectedTheme = theme instanceof HTMLSelectElement ? theme.value : '';
    const selectedYear = year instanceof HTMLSelectElement ? year.value : '';
    const direction = sort instanceof HTMLSelectElement ? sort.value : 'neu';
    const ordered = cards().sort((a, b) => {
      const left = Date.parse(a.dataset.time || '');
      const right = Date.parse(b.dataset.time || '');
      return direction === 'alt' ? left - right : right - left;
    });
    let matches = 0;
    for (const card of ordered) {
      const tags = (card.dataset.tags || '').toLowerCase().split('|').filter(Boolean);
      const text = card.textContent?.toLowerCase() || '';
      const visible =
        (!needle || text.includes(needle)) &&
        (!selectedYear || card.dataset.year === selectedYear) &&
        (!selectedTheme || tags.includes(selectedTheme.toLowerCase()));
      if (!visible) {
        card.hidden = true;
      } else {
        matches += 1;
        card.hidden = matches > shown;
      }
      grid.append(card);
    }
    if (empty instanceof HTMLElement) empty.hidden = matches !== 0;
    if (count) count.textContent = matches === 1 ? '1 Video' : `${matches} Videos`;
    if (more instanceof HTMLElement) more.hidden = matches <= shown;
    const params = new URLSearchParams();
    if (needle) params.set('q', query.value.trim());
    if (selectedTheme) params.set('thema', selectedTheme);
    if (selectedYear) params.set('jahr', selectedYear);
    if (direction === 'alt') params.set('sort', 'alt');
    if (!updateUrl) return;
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
    window.history.replaceState(null, '', next);
  };

  root.addEventListener('input', () => {
    shown = 12;
    apply(true);
  });
  root.addEventListener('change', () => {
    shown = 12;
    apply(true);
  });
  more?.addEventListener('click', (event) => {
    event.preventDefault();
    shown += 12;
    apply(false);
  });
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    shown = 12;
    apply(true);
  });
  root.addEventListener('reset', () => {
    window.setTimeout(() => {
      shown = 12;
      apply(true);
    }, 0);
  });
  apply(false);
}
