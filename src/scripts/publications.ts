// Страница «Публикации»: поиск, фильтры, сортировка, копирование BibTeX и строки цитирования.
// Записи уже есть в HTML; здесь они только скрываются и переставляются. Состояние — в адресе страницы.

type Filter = 'type' | 'index' | 'tag';
interface State {
  q: string;
  type: Set<string>;
  index: Set<string>;
  tag: Set<string>;
  sort: 'desc' | 'asc';
}

const root = document.getElementById('pub-root');
if (root) init(root);

function init(root: HTMLElement) {
  const msg = root.dataset;
  const list = document.getElementById('pub-list') as HTMLElement;
  const sections = [...list.querySelectorAll<HTMLElement>('section.pub-year')];
  const items = [...list.querySelectorAll<HTMLElement>('li.pub')];
  const order = new Map(sections.map((s) => [s, [...s.querySelectorAll<HTMLElement>('li.pub')]]));
  const yearList = root.querySelector<HTMLElement>('.year-nav ul')!;
  const yearItems = [...yearList.querySelectorAll<HTMLLIElement>('li')];
  const filters = document.getElementById('pub-filters') as HTMLElement;
  const input = document.getElementById('pub-q') as HTMLInputElement;
  const sortSelect = document.getElementById('pub-sort') as HTMLSelectElement;
  const counter = document.getElementById('pub-count') as HTMLElement;
  const empty = document.getElementById('pub-empty') as HTMLElement;
  const reset = document.getElementById('pub-reset') as HTMLButtonElement;
  const tagsBox = document.getElementById('pub-tags') as HTMLDetailsElement;
  const chips = [...filters.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  filters.hidden = false;

  // ---------- Поиск: регистр, ё/е и кириллица/латиница не важны ----------
  const TR: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
    м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  // y и i не различаем: Baykin = Baikin, Kopeykin = Kopeikin
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/ё/g, 'е')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/y/g, 'i')
      .replace(/\s+/g, ' ');
  const translit = (s: string) => [...s].map((c) => TR[c] ?? c).join('');
  const haystack = new Map(items.map((li) => [li, norm(`${li.textContent ?? ''} ${li.dataset.alt ?? ''}`)]));
  const matches = (li: HTMLElement, terms: string[]) => {
    const h = haystack.get(li)!;
    return terms.every((term) => h.includes(term) || h.includes(norm(translit(term))));
  };
  const values = (li: HTMLElement, key: 'type' | 'index' | 'tags') => (li.dataset[key] ?? '').split(' ').filter(Boolean);

  // ---------- Состояние ↔ адрес ----------
  function readUrl(): State {
    const p = new URLSearchParams(location.search);
    const set = (name: string) => new Set((p.get(name) ?? '').split(',').filter(Boolean));
    return { q: p.get('q') ?? '', type: set('type'), index: set('index'), tag: set('tag'), sort: p.get('sort') === 'asc' ? 'asc' : 'desc' };
  }
  function writeUrl(s: State) {
    const p = new URLSearchParams();
    if (s.q.trim()) p.set('q', s.q.trim());
    for (const key of ['type', 'index', 'tag'] as const) if (s[key].size) p.set(key, [...s[key]].join(','));
    if (s.sort === 'asc') p.set('sort', 'asc');
    const query = p.toString().replace(/%2C/g, ',');
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }

  const state = readUrl();
  let currentSort: State['sort'] = 'desc';

  function apply() {
    const terms = norm(state.q).split(' ').filter(Boolean);
    let shown = 0;
    for (const li of items) {
      const ok =
        (!state.type.size || values(li, 'type').some((v) => state.type.has(v))) &&
        (!state.index.size || values(li, 'index').some((v) => state.index.has(v))) &&
        (!state.tag.size || values(li, 'tags').some((v) => state.tag.has(v))) &&
        matches(li, terms);
      li.hidden = !ok;
      if (ok) shown++;
    }
    sections.forEach((sec, i) => {
      const visible = order.get(sec)!.some((li) => !li.hidden);
      sec.hidden = !visible;
      yearItems[i].hidden = !visible;
    });
    if (state.sort !== currentSort) {
      currentSort = state.sort;
      const asc = currentSort === 'asc';
      list.append(...(asc ? [...sections].reverse() : sections));
      yearList.append(...(asc ? [...yearItems].reverse() : yearItems));
      for (const sec of sections) {
        const ol = sec.querySelector('ol')!;
        ol.append(...(asc ? [...order.get(sec)!].reverse() : order.get(sec)!));
      }
    }
    counter.textContent = (msg.msgCount ?? '').replace('{n}', String(shown)).replace('{total}', String(items.length));
    empty.hidden = shown > 0;
    reset.hidden = !(state.q.trim() || state.type.size || state.index.size || state.tag.size || state.sort === 'asc');
    for (const chip of chips) {
      const key = chip.dataset.filter as Filter;
      chip.setAttribute('aria-pressed', String(state[key].has(chip.dataset.value ?? '')));
    }
    if (state.tag.size) tagsBox.open = true;
    if (input.value !== state.q) input.value = state.q;
    sortSelect.value = state.sort;
  }

  const update = (change: (s: State) => void) => {
    change(state);
    apply();
    writeUrl(state);
  };

  // ---------- События ----------
  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => update((s) => (s.q = input.value)), 150);
  });
  sortSelect.addEventListener('change', () => update((s) => (s.sort = sortSelect.value === 'asc' ? 'asc' : 'desc')));
  for (const chip of chips)
    chip.addEventListener('click', () =>
      update((s) => {
        const set = s[chip.dataset.filter as Filter];
        const v = chip.dataset.value ?? '';
        if (set.has(v)) set.delete(v);
        else set.add(v);
      }),
    );
  reset.addEventListener('click', () => {
    update((s) => {
      s.q = '';
      s.type.clear();
      s.index.clear();
      s.tag.clear();
      s.sort = 'desc';
    });
    input.focus();
  });

  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    // Тег у записи — включить фильтр по нему, не перезагружая страницу
    const tagLink = target.closest<HTMLAnchorElement>('a[data-tag]');
    if (tagLink) {
      e.preventDefault();
      update((s) => s.tag.add(tagLink.dataset.tag ?? ''));
      const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
      filters.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
      return;
    }

    // «Подробнее»: раскрыть аннотацию под записью
    const toggle = target.closest<HTMLButtonElement>('button[data-toggle]');
    if (toggle) {
      const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      const label = toggle.querySelector('span');
      if (label) label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? '';
      if (panel) panel.hidden = !open;
      return;
    }

    // Копирование: BibTeX — текстом, строка цитирования — текстом и HTML (курсив сохранится в Word)
    const copyBtn = target.closest<HTMLButtonElement>('button[data-copy-text]');
    if (copyBtn) void copy(copyBtn.dataset.copyText ?? '', copyBtn.dataset.copyHtml);
  });

  // Ссылка на запись (#ключ): показать её, даже если фильтры из адреса её скрывали
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const heading = id ? document.getElementById(id) : null;
    const li = heading?.closest<HTMLElement>('li.pub');
    if (li?.hidden) {
      update((s) => {
        s.q = '';
        s.type.clear();
        s.index.clear();
        s.tag.clear();
      });
      heading?.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', revealHash);

  apply();
  revealHash();

  // ---------- Буфер обмена и уведомление ----------
  const toast = document.getElementById('pub-toast') as HTMLElement;
  let toastTimer = 0;
  function notify(text: string) {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast.hidden = true), 1800);
  }
  // Clipboard API есть во всех современных браузерах на HTTPS (GitHub Pages)
  async function copy(text: string, html?: string) {
    try {
      if (html && 'ClipboardItem' in window) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/plain': new Blob([text], { type: 'text/plain' }),
            'text/html': new Blob([html], { type: 'text/html' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      notify(msg.msgCopied ?? '');
    } catch {
      notify(msg.msgCopyFailed ?? '');
    }
  }
}
