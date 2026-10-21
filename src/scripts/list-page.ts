// Общий скрипт страниц-списков («Публикации», «Выступления»): поиск, фильтры, сортировка по годам,
// копирование в буфер, «Подробнее», встроенные PDF и видео. Все записи уже есть в HTML — скрипт только
// скрывает и переставляет их. Состояние фильтров хранится в адресе: ?q=…&<фильтр>=a,b&sort=asc
//
// Разметка (атрибуты data-*):
//   [data-list-root]          — корень; data-msg-count / data-msg-copied / data-msg-copy-failed — тексты
//   [data-filters]            — панель фильтров (показывается скриптом)
//   [data-search] [data-sort] [data-count] [data-reset] [data-empty] [data-live]
//   button[data-filter][data-value] — кнопка фильтра; details[data-filter-group] раскрывается, если в ней что-то выбрано
//   [data-list] section[data-year-section] li[data-item]; у записи data-f-<фильтр>="v1 v2", data-alt — доп. текст для поиска
//   [data-year-nav] ul        — ссылки на годы
//   a[data-tag]               — тег у записи: включает фильтр tag
//   button[data-copy-text] (+ data-copy-html) — копирование
//   «Подробнее» и встроенные PDF / видео — src/scripts/panels.ts

import { bindPanels } from './panels';

const root = document.querySelector<HTMLElement>('[data-list-root]');
if (root) init(root);

function init(root: HTMLElement) {
  const msg = root.dataset;
  const $ = <T extends Element>(sel: string) => root.querySelector<T>(sel);
  const list = $<HTMLElement>('[data-list]')!;
  const sections = [...list.querySelectorAll<HTMLElement>('section[data-year-section]')];
  const items = [...list.querySelectorAll<HTMLElement>('li[data-item]')];
  const order = new Map(sections.map((s) => [s, [...s.querySelectorAll<HTMLElement>('li[data-item]')]]));
  const yearList = $<HTMLElement>('[data-year-nav] ul');
  const yearItems = yearList ? [...yearList.querySelectorAll<HTMLLIElement>('li')] : [];
  const filters = $<HTMLElement>('[data-filters]');
  const input = $<HTMLInputElement>('[data-search]');
  const sortSelect = $<HTMLSelectElement>('[data-sort]');
  const counter = $<HTMLElement>('[data-count]');
  const empty = $<HTMLElement>('[data-empty]');
  const reset = $<HTMLButtonElement>('[data-reset]');
  const live = $<HTMLElement>('[data-live]');
  const chips = [...root.querySelectorAll<HTMLButtonElement>('button[data-filter][data-value]')];
  const groups = [...root.querySelectorAll<HTMLDetailsElement>('details[data-filter-group]')];
  const keys = [...new Set(chips.map((c) => c.dataset.filter!))];
  if (filters) filters.hidden = false;
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Поиск: регистр, ё/е, y/i и кириллица/латиница не важны ----------
  const TR: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
    м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
    щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
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
  const values = (li: HTMLElement, key: string) => (li.getAttribute(`data-f-${key}`) ?? '').split(' ').filter(Boolean);

  // ---------- Состояние ↔ адрес ----------
  interface State {
    q: string;
    sort: 'desc' | 'asc';
    f: Map<string, Set<string>>;
  }
  function readUrl(): State {
    const p = new URLSearchParams(location.search);
    const f = new Map(keys.map((k) => [k, new Set((p.get(k) ?? '').split(',').filter(Boolean))]));
    return { q: p.get('q') ?? '', sort: p.get('sort') === 'asc' ? 'asc' : 'desc', f };
  }
  function writeUrl(s: State) {
    const p = new URLSearchParams();
    if (s.q.trim()) p.set('q', s.q.trim());
    for (const [k, set] of s.f) if (set.size) p.set(k, [...set].join(','));
    if (s.sort === 'asc') p.set('sort', 'asc');
    const query = p.toString().replace(/%2C/g, ',');
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
  }
  const state = readUrl();
  const active = () => [...state.f.values()].some((s) => s.size > 0);
  let currentSort: State['sort'] = 'desc';

  function apply() {
    const terms = norm(state.q).split(' ').filter(Boolean);
    let shown = 0;
    for (const li of items) {
      let ok = matches(li, terms);
      for (const [k, set] of state.f) if (ok && set.size) ok = values(li, k).some((v) => set.has(v));
      li.hidden = !ok;
      if (ok) shown++;
    }
    sections.forEach((sec, i) => {
      const visible = order.get(sec)!.some((li) => !li.hidden);
      sec.hidden = !visible;
      if (yearItems[i]) yearItems[i].hidden = !visible;
    });
    if (state.sort !== currentSort) {
      currentSort = state.sort;
      const asc = currentSort === 'asc';
      list.append(...(asc ? [...sections].reverse() : sections));
      yearList?.append(...(asc ? [...yearItems].reverse() : yearItems));
      for (const sec of sections) sec.querySelector('ol')?.append(...(asc ? [...order.get(sec)!].reverse() : order.get(sec)!));
    }
    if (counter) counter.textContent = (msg.msgCount ?? '').replace('{n}', String(shown)).replace('{total}', String(items.length));
    if (empty) empty.hidden = shown > 0;
    if (reset) reset.hidden = !(state.q.trim() || active() || state.sort === 'asc');
    for (const chip of chips) chip.setAttribute('aria-pressed', String(state.f.get(chip.dataset.filter!)?.has(chip.dataset.value!) ?? false));
    for (const g of groups) if (g.querySelector('[aria-pressed="true"]')) g.open = true;
    if (input && input.value !== state.q) input.value = state.q;
    if (sortSelect) sortSelect.value = state.sort;
  }
  const update = (change: (s: State) => void) => {
    change(state);
    apply();
    writeUrl(state);
  };

  // ---------- Фильтры, поиск, сортировка ----------
  let timer = 0;
  input?.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => update((s) => (s.q = input.value)), 150);
  });
  sortSelect?.addEventListener('change', () => update((s) => (s.sort = sortSelect.value === 'asc' ? 'asc' : 'desc')));
  for (const chip of chips)
    chip.addEventListener('click', () =>
      update((s) => {
        const set = s.f.get(chip.dataset.filter!)!;
        const v = chip.dataset.value!;
        if (set.has(v)) set.delete(v);
        else set.add(v);
      }),
    );
  reset?.addEventListener('click', () => {
    update((s) => {
      s.q = '';
      s.sort = 'desc';
      for (const set of s.f.values()) set.clear();
    });
    input?.focus();
  });

  // ---------- Действия внутри записей: тег → фильтр, копирование; «Подробнее» — в panels.ts ----------
  bindPanels(list);
  list.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;

    const tagLink = target.closest<HTMLAnchorElement>('a[data-tag]');
    if (tagLink && state.f.has('tag')) {
      e.preventDefault();
      update((s) => s.f.get('tag')!.add(tagLink.dataset.tag ?? ''));
      filters?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }

    const copyBtn = target.closest<HTMLButtonElement>('button[data-copy-text]');
    if (copyBtn) void copy(copyBtn, copyBtn.dataset.copyText ?? '', copyBtn.dataset.copyHtml);
  });

  // ---------- Ссылка на запись (#id): показать её, даже если фильтры из адреса её скрывали ----------
  function revealHash() {
    const id = decodeURIComponent(location.hash.slice(1));
    const target = id ? document.getElementById(id) : null;
    const li = target?.closest<HTMLElement>('li[data-item]');
    if (li?.hidden) {
      update((s) => {
        s.q = '';
        for (const set of s.f.values()) set.clear();
      });
      target?.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', revealHash);
  apply();
  revealHash();

  // ---------- Копирование: «Скопировано» всплывает над кнопкой и плавно исчезает ----------
  const CHECK =
    '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  function bubble(btn: HTMLElement, text: string, ok: boolean) {
    btn.querySelector('.copy-bubble')?.remove();
    const b = document.createElement('span');
    b.className = ok ? 'copy-bubble' : 'copy-bubble copy-bubble-error';
    b.setAttribute('aria-hidden', 'true');
    b.innerHTML = `${ok ? CHECK : ''}<span></span>`;
    b.lastElementChild!.textContent = text;
    btn.append(b);
    const done = () => b.remove();
    b.addEventListener('animationend', done, { once: true });
    window.setTimeout(done, 2500);
    if (live) {
      live.textContent = '';
      window.setTimeout(() => (live.textContent = text), 50);
    }
  }
  // Clipboard API есть во всех современных браузерах на HTTPS (GitHub Pages)
  async function copy(btn: HTMLElement, text: string, html?: string) {
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
      bubble(btn, msg.msgCopied ?? '', true);
    } catch {
      bubble(btn, msg.msgCopyFailed ?? '', false);
    }
  }
}
