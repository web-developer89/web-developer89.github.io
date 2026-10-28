function focusable(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (element) => !element.hasAttribute('disabled') && element.tabIndex !== -1 && !element.closest('[hidden]'),
  );
}

function setupHeader(): void {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

function setupMenu(): void {
  const button = document.querySelector('[data-menu-button]');
  const panel = document.querySelector('[data-menu-panel]');
  const closeButton = document.querySelector('[data-menu-close]');
  if (!(button instanceof HTMLButtonElement) || !(panel instanceof HTMLElement)) return;

  const close = (restoreFocus = true) => {
    panel.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('lock');
    const finish = () => {
      panel.hidden = true;
      if (restoreFocus) button.focus();
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else window.setTimeout(finish, 180);
  };

  const open = () => {
    panel.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('lock');
    window.requestAnimationFrame(() => panel.classList.add('is-open'));
    closeButton instanceof HTMLElement && closeButton.focus();
  };

  button.addEventListener('click', () => {
    if (panel.hidden) open();
    else close();
  });
  closeButton?.addEventListener('click', () => close());
  document.addEventListener('pmk:close-menu', () => {
    if (!panel.hidden) close(false);
  });
  panel.addEventListener('click', (event) => {
    const target = event.target;
    if (target instanceof HTMLAnchorElement && target.hasAttribute('data-search-open')) return;
    if (target instanceof HTMLElement && target.closest('a')) close();
  });
  document.addEventListener('keydown', (event) => {
    if (panel.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const nodes = focusable(panel);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function setupSearch(): void {
  const dialog = document.querySelector('[data-search-dialog]');
  const input = document.querySelector('[data-search-input]');
  const results = document.querySelector('[data-search-results]');
  const label = document.querySelector('[data-search-label]');
  if (!(dialog instanceof HTMLDialogElement) || !(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return;

  let index: { href: string; title: string; kind: string; date?: string; text: string }[] = [];
  let loading: Promise<typeof index> | null = null;
  const ensureIndex = () => {
    if (!loading) {
      loading = fetch('/search-index.json')
        .then((response) => (response.ok ? response.json() : []))
        .then((data) => {
          index = Array.isArray(data) ? data : [];
          return index;
        })
        .catch(() => {
          index = [];
          return index;
        });
    }
    return loading;
  };

  const render = (query: string) => {
    const needle = query.trim().toLowerCase();
    const source = needle
      ? index.filter((item) => item.title.toLowerCase().includes(needle) || item.text.toLowerCase().includes(needle)).slice(0, 8)
      : index.filter((item) => item.kind === 'Video').slice(0, 5);
    results.replaceChildren();
    if (label) label.textContent = needle ? 'Treffer' : 'Zuletzt veröffentlicht';
    if (!source.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Keine Treffer.';
      results.append(empty);
      return;
    }
    const list = document.createElement('ul');
    list.className = 'search-list';
    for (const item of source) {
      const entry = document.createElement('li');
      const link = document.createElement('a');
      link.href = item.href;
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = item.kind;
      const title = document.createElement('span');
      title.textContent = item.title;
      link.append(badge, title);
      entry.append(link);
      list.append(entry);
    }
    results.append(list);
  };

  const open = async (event?: Event) => {
    event?.preventDefault();
    document.dispatchEvent(new CustomEvent('pmk:close-menu'));
    if (!dialog.open) dialog.showModal();
    input.focus();
    await ensureIndex();
    render(input.value);
  };

  document.querySelectorAll('[data-search-open]').forEach((node) => node.addEventListener('click', open));
  input.addEventListener('input', () => render(input.value));
  document.addEventListener('keydown', (event) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (dialog.open) return;
    open(event);
  });
}

function setupCopy(): void {
  document.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest('[data-copy]');
    if (!(button instanceof HTMLButtonElement)) return;
    const value = button.dataset.copy;
    if (!value) return;
    const original = button.dataset.copyLabel || button.textContent || 'Kopieren';
    button.dataset.copyLabel = original;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = button.dataset.copySuccess || 'Kopiert';
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    } catch {
      button.textContent = 'Kopieren nicht möglich';
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    }
  });
}

function setupImages(): void {
  document.addEventListener(
    'error',
    (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const fallback = image.dataset.fallback;
      if (!fallback || image.dataset.fallbackTried === '1') return;
      image.dataset.fallbackTried = '1';
      let next = fallback;
      try {
        next = new URL(fallback, window.location.href).href;
      } catch {
        next = fallback;
      }
      if (image.src === next) return;
      image.src = next;
    },
    true,
  );
}

function setupDeferredAssets(): void {
  const apply = () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/fonts/fonts.css';
    document.head.append(link);
    document.documentElement.style.setProperty(
      '--texture',
      'image-set(url("/optimized/images/politik-mit-kopf-background-1600.avif") type("image/avif"), url("/optimized/images/politik-mit-kopf-background-1600.webp") type("image/webp"))',
    );
  };
  window.addEventListener('load', apply, { once: true });
}

setupHeader();
setupMenu();
setupSearch();
setupCopy();
setupImages();
setupDeferredAssets();

