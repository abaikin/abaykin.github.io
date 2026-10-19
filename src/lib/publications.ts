// Вывод публикаций: имена авторов, выходные данные, строки цитирования (ГОСТ Р 7.0.5-2008 и APA),
// журналы (ВАК, «Белый список»), транслитерация для поиска. Данные — коллекция publications.
import katex from 'katex';
import type { CollectionEntry } from 'astro:content';
import { DATE_LOCALE, type Lang } from '../i18n';

export type Pub = CollectionEntry<'publications'>;
export type PubData = Pub['data'];
export type Journal = CollectionEntry<'journals'>['data'];

// ---------- Текст и HTML ----------

export const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Формулы $…$ → исходный текст TeX (для строк цитирования и поиска) */
export const plain = (s: string) => s.replace(/\$([^$]+)\$/g, '$1');

/** Текст с формулами $…$ → HTML (KaTeX), абзацы через пустую строку */
export function texHtml(s: string, paragraphs = false): string {
  const inline = (t: string) =>
    t
      .split(/(\$[^$]+\$)/g)
      .map((part) =>
        part.length > 2 && part.startsWith('$') && part.endsWith('$')
          ? katex.renderToString(part.slice(1, -1), { throwOnError: false, output: 'html' })
          : esc(part),
      )
      .join('');
  if (!paragraphs) return inline(s);
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${inline(p.trim())}</p>`)
    .join('');
}

// ---------- Транслитерация (поиск, английская версия имён) ----------

const TR: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l',
  м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
export function translit(s: string): string {
  return [...s]
    .map((c) => {
      const low = c.toLowerCase();
      const t = TR[low];
      if (t === undefined) return c;
      return c !== low && t ? t[0].toUpperCase() + t.slice(1) : t;
    })
    .join('');
}

/** Нормализация для поиска: регистр, ё → е, без диакритики */
export const normalize = (s: string) =>
  s.toLowerCase().replace(/ё/g, 'е').normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ');

// ---------- Авторы ----------

export interface Name {
  family: string;
  given: string;
}

/** «Family, I. I.» или «I. I. Family» → части имени; инициалы приводятся к виду «A. N.» */
export function parseName(s: string): Name {
  const comma = s.indexOf(',');
  const [family, given] =
    comma >= 0
      ? [s.slice(0, comma), s.slice(comma + 1)]
      : [s.trim().split(/\s+/).pop() ?? s, s.trim().split(/\s+/).slice(0, -1).join(' ')];
  return { family: family.trim(), given: given.trim().replace(/\.(?=\S)/g, '. ').replace(/\s+/g, ' ') };
}

/** Фамилии владельца сайта во всех написаниях (из profile.yaml: name_ru, name_en, alt_names) */
export function ownerFamilies(names: string[]): Set<string> {
  const out = new Set<string>();
  for (const n of names)
    for (const token of n.split(/[\s,]+/))
      if (token.length > 2 && !token.includes('.')) {
        out.add(normalize(token));
        out.add(normalize(translit(token)));
      }
  return out;
}

export const isOwner = (n: Name, owners: Set<string>) => owners.has(normalize(n.family));

/** Авторы для показа на языке страницы: на английской — латиницей (author_en или транслитерация) */
export function displayAuthors(d: PubData, lang: Lang): Name[] {
  if (lang === 'en') {
    if (d.authors_en.length) return d.authors_en.map(parseName);
    return d.authors.map((a) => {
      const n = parseName(a);
      return { family: translit(n.family), given: translit(n.given) };
    });
  }
  return d.authors.map(parseName);
}

// ---------- Журналы: ВАК и «Белый список» ----------

export function findJournal(d: PubData, journals: Journal[]): Journal | undefined {
  if (d.kind !== 'article') return undefined;
  const byIssn = journals.find((j) => j.issn.some((i) => d.issn.includes(i)));
  if (byIssn) return byIssn;
  const name = d.journal ? normalize(d.journal) : '';
  return journals.find((j) => [j.name_ru, j.name_en].some((n) => n && normalize(n) === name));
}

export interface Badge {
  /** Значение для фильтра «Индексация»: wos, scopus, rinc, rinc-core, rsci, vak, wl */
  key: string;
  label: string;
  title: string;
  href?: string;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

/** Значки индексации: из записи (WoS, Scopus, РИНЦ, ядро РИНЦ) и из журнала (ВАК, уровень «Белого списка») */
export function indexBadges(d: PubData, journal: Journal | undefined, lang: Lang, t: Translate): Badge[] {
  const out: Badge[] = d.indexing.map((v) => ({
    key: v,
    label: t(`pubs.index.${v}`),
    title: t(`pubs.tip.${v}`),
    href: (v === 'rinc' || v === 'rinc-core') && d.elibrary ? `https://elibrary.ru/item.asp?id=${d.elibrary}` : undefined,
  }));
  if (journal?.vak) {
    const cat = lang === 'ru' ? journal.vak.replace('K', 'К') : journal.vak;
    out.push({
      key: 'vak',
      label: t('pubs.badge.vak', { cat }),
      title: t(journal.vak_basis === 'equated' ? 'pubs.tip.vakEquated' : 'pubs.tip.vakList', { cat }),
    });
  }
  if (journal?.white_list)
    out.push({
      key: 'wl',
      label: t('pubs.badge.wl', { level: journal.white_list }),
      title: t('pubs.tip.wl', { level: journal.white_list, year: journal.white_list_year ?? '' }),
    });
  return out;
}

// ---------- Переводные версии (оригинал ↔ перевод) ----------

export interface Partner {
  /** Вторая версия статьи */
  other: Pub;
  /** true — вторая версия является переводом этой; false — вторая версия — оригинал */
  otherIsTranslation: boolean;
}

/**
 * Пары «оригинал — перевод» по полям BibLaTeX: у переводной версии related = {ключ оригинала},
 * relatedtype = {translationof}; или у оригинала relatedtype = {translationas}. Связь указывается один раз.
 */
export function translationPartners(pubs: Pub[]): Map<string, Partner> {
  const byId = new Map(pubs.map((p) => [p.id, p]));
  const out = new Map<string, Partner>();
  for (const p of pubs) {
    if (p.data.relatedtype !== 'translationof' && p.data.relatedtype !== 'translationas') continue;
    for (const ref of p.data.related) {
      const other = byId.get(ref.id);
      if (!other) throw new Error(`publications.bib «${p.id}»: related = {${ref.id}} — такой записи нет`);
      const pIsTranslation = p.data.relatedtype === 'translationof';
      out.set(p.id, { other, otherIsTranslation: !pIsTranslation });
      out.set(other.id, { other: p, otherIsTranslation: pIsTranslation });
    }
  }
  return out;
}

/** Какую версию пары показывать на странице языка lang: на языке страницы, иначе оригинал */
export function isMainVersion(pub: Pub, partner: Partner | undefined, lang: Lang): boolean {
  if (!partner) return true;
  if (pub.data.lang === lang) return true;
  if (partner.other.data.lang === lang) return false;
  return partner.otherIsTranslation;
}

// ---------- Даты ----------

export function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!m) return String(y);
  const date = new Date(Date.UTC(y, m - 1, d || 1));
  return lang === 'ru'
    ? date.toLocaleDateString(DATE_LOCALE.ru, d ? { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' } : { month: '2-digit', year: 'numeric', timeZone: 'UTC' })
    : date.toLocaleDateString(DATE_LOCALE.en, d ? { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' } : { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

// ---------- Выходные данные для списка (на языке страницы) ----------

const isRange = (p: string) => /[–-]/.test(p);

/** Выходные данные одной строкой: журнал, год, том, номер, страницы — или реквизиты РИД */
export function venueLine(d: PubData, lang: Lang): string {
  const ru = lang === 'ru';
  const parts: string[] = [];
  const pages = d.pages ? (ru ? `С. ${d.pages}` : `${isRange(d.pages) ? 'pp.' : 'p.'} ${d.pages}`) : d.eid ? (ru ? `Ст. ${d.eid}` : `art. ${d.eid}`) : '';
  switch (d.kind) {
    case 'article': {
      const journal = !ru && d.journal_en ? d.journal_en : d.journal;
      const vol = [d.volume && (ru ? `Т. ${d.volume}` : `vol. ${d.volume}`), d.number && (ru ? `№ ${d.number}` : `no. ${d.number}`)]
        .filter(Boolean)
        .join(', ');
      if (ru) return [journal, String(d.year), vol, pages].filter(Boolean).join('. ');
      return [journal, String(d.year), vol, pages].filter(Boolean).join(', ');
    }
    case 'proceedings':
    case 'abstract': {
      const book = !ru && d.booktitle_en ? d.booktitle_en : d.booktitle;
      if (book) parts.push(d.volume ? `${book}${ru ? `. Т. ${d.volume}` : `, vol. ${d.volume}`}` : book);
      const place = [d.address, d.publisher].filter(Boolean).join(': ');
      parts.push(place ? `${place}, ${d.year}` : String(d.year));
      if (pages) parts.push(pages);
      return parts.join(ru ? '. ' : ', ');
    }
    case 'patent': {
      const holder = !ru && d.holder_en ? d.holder_en : d.holder;
      parts.push(`${ru ? 'Патент' : 'Patent'} ${d.number ?? ''}`.trim());
      if (d.date) parts.push(formatDate(d.date, lang));
      if (holder) parts.push(`${ru ? 'патентообладатель' : 'patent holder'}: ${holder}`);
      return parts.join(', ');
    }
    case 'software': {
      const holder = !ru && d.holder_en ? d.holder_en : d.holder;
      parts.push(ru ? `Свидетельство о регистрации программы для ЭВМ № ${d.number}` : `Software registration certificate No. ${d.number}`);
      if (d.date) parts.push(formatDate(d.date, lang));
      if (holder) parts.push(`${ru ? 'правообладатель' : 'rights holder'}: ${holder}`);
      return parts.join(', ');
    }
    case 'thesis':
      return ru
        ? [d.thesis_type, [d.institution, d.address].filter(Boolean).join(', '), String(d.year)].filter(Boolean).join('. ')
        : `Candidate of Sciences (PhD) dissertation, ${d.year}`;
    default:
      return [d.publisher, String(d.year)].filter(Boolean).join(', ');
  }
}

// ---------- Строки цитирования ----------

export interface Citation {
  text: string;
  html: string;
}
const toText = (html: string) =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
const endDot = (s: string) => (/[.!?…]$/.test(s) ? s : `${s}.`);

/** ГОСТ Р 7.0.5-2008: до трёх авторов — в заголовке, четыре и больше — после косой черты */
function gost(d: PubData): Citation {
  const L = d.lang === 'ru' ? { vol: 'Т.', no: '№', p: 'С.', art: 'Ст.', etal: 'и др.' } : { vol: 'Vol.', no: 'no.', p: 'P.', art: 'Art.', etal: 'et al.' };
  const names = d.authors.map(parseName);
  const heading = (n: Name) => `${n.family} ${n.given}`.trim();
  const initialsFirst = (n: Name) => `${n.given} ${n.family}`.trim();
  const resp = (all: boolean) => {
    if (!all && names.length <= 3) return '';
    const shown = names.length <= 4 ? names : names.slice(0, 3);
    return shown.map(initialsFirst).join(', ') + (names.length > 4 ? ` [${L.etal}]` : '');
  };
  const title = esc(plain(d.title));
  const date = d.date ? d.date.split('-').reverse().join('.') : String(d.year);
  const link = d.doi ? ` DOI: ${esc(d.doi)}.` : d.url ? ` URL: ${esc(d.url)}.` : '';
  let s = '';
  switch (d.kind) {
    case 'patent':
      s = `${title} : пат. ${esc(d.number ?? '')} / ${esc(resp(true))}${d.holder ? ` ; патентообладатель ${esc(d.holder)}` : ''}. Опубл. ${date}.${d.note ? ` ${esc(endDot(d.note))}` : ''}`;
      return { html: s, text: toText(s) };
    case 'software':
      s = `${title} : свидетельство о гос. регистрации программы для ЭВМ № ${esc(d.number ?? '')} / ${esc(resp(true))}${d.holder ? ` ; правообладатель ${esc(d.holder)}` : ''}. Дата регистрации ${date}.`;
      return { html: s, text: toText(s) };
  }
  const head = names.length <= 3 ? `${esc(names.map(heading).join(', '))} ` : '';
  const after = resp(false) ? ` / ${esc(resp(false))}` : '';
  s = `${head}${title}${after}`;
  if (d.kind === 'thesis') {
    s += `${d.thesis_type ? ` : ${esc(d.thesis_type)}` : ''}. ${esc([d.address, String(d.year)].filter(Boolean).join(', '))}.`;
    return { html: s, text: toText(s) };
  }
  const pages = d.pages ? ` ${L.p} ${esc(d.pages)}.` : d.eid ? ` ${L.art} ${esc(d.eid)}.` : '';
  if (d.kind === 'article') {
    const vol = [d.volume && `${L.vol} ${esc(d.volume)}`, d.number && `${L.no} ${esc(d.number)}`].filter(Boolean).join(', ');
    s += ` // ${esc(d.journal ?? '')}. ${d.year}.${vol ? ` ${vol}.` : ''}${pages}${link}`;
  } else {
    const place = d.address && d.publisher ? `${d.address} : ${d.publisher}, ` : d.publisher ? `${d.publisher}, ` : d.address ? `${d.address}, ` : '';
    s += ` // ${esc(d.booktitle ?? '')}.${d.volume ? ` ${L.vol} ${esc(d.volume)}.` : ''} ${esc(place)}${d.year}.${pages}${link}`;
  }
  return { html: s, text: toText(s) };
}

/**
 * APA 7. Русскоязычные работы пишутся латиницей (APA требует транслитерации): авторы — author_en
 * или транслитерация, название — транслитерация и перевод в квадратных скобках, издание — journal_en/booktitle_en
 * или транслитерация.
 */
function apa(d: PubData): Citation {
  const ru = d.lang === 'ru';
  const tr = (s: string | undefined) => (s && ru ? translit(s) : (s ?? ''));
  const names = displayAuthors(d, ru ? 'en' : d.lang).map((n) => `${n.family}, ${n.given}`);
  const authors =
    names.length === 1
      ? names[0]
      : names.length <= 20
        ? `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`
        : `${names.slice(0, 19).join(', ')}, … ${names.at(-1)}`;
  const translated = ru && d.title_en ? ` [${plain(d.title_en)}]` : '';
  const title = esc(plain(tr(d.title)));
  const link = d.doi ? ` https://doi.org/${esc(d.doi)}` : d.url ? ` ${esc(d.url)}` : '';
  const pp = d.pages ? (isRange(d.pages) ? `pp. ${esc(d.pages)}` : `p. ${esc(d.pages)}`) : '';
  let s = `${esc(authors)} (${d.year}). `;
  switch (d.kind) {
    case 'article': {
      const journal = ru ? (d.journal_en ?? tr(d.journal)) : (d.journal ?? '');
      const vol = d.volume ? `, <i>${esc(d.volume)}</i>` : '';
      const no = d.number ? (d.volume ? `(${esc(d.number)})` : `, (${esc(d.number)})`) : '';
      const where = d.pages ? `, ${esc(d.pages)}` : d.eid ? `, Article ${esc(d.eid)}` : '';
      s += `${endDot(title + esc(translated))} <i>${esc(journal)}</i>${vol}${no}${where}.${link}`;
      break;
    }
    case 'proceedings':
    case 'abstract': {
      const book = ru ? (d.booktitle_en ?? tr(d.booktitle)) : (d.booktitle ?? '');
      const publisher = tr(d.publisher);
      const where = [d.volume && `Vol. ${esc(d.volume)}`, pp].filter(Boolean).join(', ');
      s += `${endDot(title + esc(translated))} In <i>${esc(book)}</i>${where ? ` (${where})` : ''}.${publisher ? ` ${esc(endDot(publisher))}` : ''}${link}`;
      break;
    }
    case 'patent':
      s += `<i>${title}</i>${esc(translated)} (Russian Federation Patent No. ${esc(d.number ?? '')}). Rospatent.${link}`;
      break;
    case 'software':
      s += `<i>${title}</i>${esc(translated)} (Certificate of state registration of computer program No. ${esc(d.number ?? '')}). Rospatent.${link}`;
      break;
    default:
      s += `<i>${title}</i>${esc(translated)}.${link}`;
  }
  return { html: s, text: toText(s) };
}

/** Строка цитирования: на русской странице — ГОСТ, на английской — APA (или ручная строка из .bib) */
export function citation(d: PubData, lang: Lang): Citation {
  const manual = lang === 'ru' ? d.citation_ru : d.citation_en;
  if (manual) return { text: manual, html: esc(manual) };
  return lang === 'ru' ? gost(d) : apa(d);
}

// ---------- Порядок в списке ----------

const CATEGORY_ORDER = { journal: 0, conference: 1, rid: 2, other: 3 } as const;

/** Внутри года: статьи, конференции, РИД, прочее; затем по дате (новые выше) */
export function comparePubs(a: Pub, b: Pub): number {
  return (
    b.data.year - a.data.year ||
    CATEGORY_ORDER[a.data.category] - CATEGORY_ORDER[b.data.category] ||
    (b.data.date ?? '').localeCompare(a.data.date ?? '') ||
    a.id.localeCompare(b.id)
  );
}
