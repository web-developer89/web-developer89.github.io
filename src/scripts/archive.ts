export function setupArchive(): void {
  const root = document.querySelector('[data-archive]');
  if (!(root instanceof HTMLElement)) return;
  const grid = root.querySelector('[data-archive-grid]');
  const empty = root.querySelector('[data-archive-empty]');
  const count = root.querySelector('[data-archive-count]');
  const more = root.querySelector('[data-archive-more]');
  const query = root.querySelector('[name="q"]');
  const channel = root.querySelector('[name="kanal"]');
  const year = root.querySelector('[name="jahr"]');
  const sort = root.querySelector('[name="sort"]');
  if (!(grid instanceof HTMLElement) || !(query instanceof HTMLInputElement)) return;

  const channelIds = new Map<string, string>();
  for (const option of channel instanceof HTMLSelectElement ? [...channel.options] : []) {
    if (option.value) channelIds.set(option.value, option.dataset.channelId || '');
  }

  const initialParams = new URLSearchParams(window.location.search);
  const topicParam = initialParams.get('thema')?.trim() || '';
  const topic = topicParam.toLowerCase();
  let shown = Math.max(1, Number(initialParams.get('seite') || '1')) * 12;
  const cards = () => [...grid.querySelectorAll<HTMLElement>('[data-video]')];

  if (topicParam && !root.querySelector('[data-topic-notice]')) {
    const note = document.createElement('p');
    note.className = 'notice';
    note.setAttribute('role', 'status');
    note.dataset.topicNotice = '';
    const clear = document.createElement('a');
    clear.href = '/videos/';
    clear.textContent = 'Thema zurücksetzen';
    note.append(`Thema „${topicParam}“. `, clear);
    count?.before(note);
  }

  const apply = (updateUrl: boolean) => {
    const needle = query.value.trim().toLowerCase();
    const selectedChannel = channel instanceof HTMLSelectElement ? channel.value : '';
    const selectedChannelId =
      selectedChannel && channel instanceof HTMLSelectElement
        ? channel.selectedOptions[0]?.dataset.channelId || ''
        : '';
    const selectedYear = year instanceof HTMLSelectElement ? year.value : '';
    const direction = sort instanceof HTMLSelectElement ? sort.value : 'neu';
    const ordered = cards().sort((a, b) => {
      const left = Date.parse(a.dataset.time || '');
      const right = Date.parse(b.dataset.time || '');
      return direction === 'alt' ? left - right : right - left;
    });
    let matches = 0;
    for (const card of ordered) {
      const text = card.textContent?.toLowerCase() || '';
      const tags = (card.dataset.tags || '').toLowerCase().split('|').filter(Boolean);
      const visible =
        (!needle || text.includes(needle)) &&
        (!topic || tags.includes(topic)) &&
        (!selectedYear || card.dataset.year === selectedYear) &&
        (!selectedChannel || !selectedChannelId || card.dataset.channel === selectedChannelId);
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
    if (selectedChannel) params.set('kanal', selectedChannel);
    if (selectedYear) params.set('jahr', selectedYear);
    if (topicParam) params.set('thema', topicParam);
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
  apply(false);
}
