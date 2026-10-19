// Загрузчик Content Layer для src/data/publications.bib.
// Разбирает файл (src/lib/bibtex.ts), раскрывает LaTeX и отдаёт записи на проверку схеме
// из src/content.config.ts. Здесь же собирается «чистый» BibTeX без служебных полей сайта.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Loader } from 'astro/loaders';
import { type BibEntry, isTodo, parseBibtex, serializeClean, texToText } from './bibtex';

/** Поля сайта: в скачиваемый BibTeX не попадают */
export const SITE_ONLY: ReadonlySet<string> = new Set([
  'abstract', 'abstract_ru', 'abstract_en', 'title_ru', 'title_en', 'translation', 'keywords', 'indexing',
  'pubtype', 'author_order', 'author_en', 'journal_en', 'booktitle_en', 'holder_en', 'note_ru', 'note_en',
  'citation_ru', 'citation_en', 'fulltext', 'elibrary',
]);

// Стандартные поля BibTeX/BibLaTeX, которые встречаются в выгрузках издателей.
// Поле не из этого списка и не из SITE_ONLY — скорее всего опечатка: сборка предупредит.
const STANDARD = new Set([
  'author', 'editor', 'title', 'subtitle', 'journal', 'journaltitle', 'booktitle', 'eventtitle', 'venue', 'year', 'date',
  'month', 'volume', 'number', 'issue', 'pages', 'eid', 'publisher', 'address', 'location', 'institution', 'school',
  'organization', 'series', 'edition', 'type', 'holder', 'note', 'issn', 'isbn', 'doi', 'url', 'urldate', 'eprint',
  'eprinttype', 'eprintclass', 'archiveprefix', 'primaryclass', 'langid', 'language', 'pagetotal', 'howpublished',
  'related', 'relatedtype',
]);

const LANGID: Record<string, 'ru' | 'en'> = { russian: 'ru', english: 'en' };

const opt = (v: string | undefined) => (v === undefined || isTodo(v) ? undefined : texToText(v));
const list = (v: string | undefined) =>
  v === undefined || isTodo(v) ? [] : v.split(',').map((s) => s.trim()).filter(Boolean);
const people = (v: string | undefined) =>
  v === undefined || isTodo(v) ? [] : v.split(/\s+and\s+/).map((a) => texToText(a)).filter(Boolean);

/** Группа фильтра «Тип» и вид записи */
function kindOf(e: BibEntry) {
  const sub = e.fields.pubtype?.trim();
  switch (e.type) {
    case 'article':
      return sub === 'preprint' ? { category: 'other', kind: 'preprint' } : { category: 'journal', kind: 'article' };
    case 'inproceedings':
    case 'incollection':
    case 'conference':
      return { category: 'conference', kind: sub === 'abstract' ? 'abstract' : 'proceedings' };
    case 'patent':
      return { category: 'rid', kind: 'patent' };
    case 'software':
      return { category: 'rid', kind: 'software' };
    case 'thesis':
    case 'phdthesis':
    case 'mastersthesis':
      return { category: 'other', kind: 'thesis' };
    default:
      return { category: 'other', kind: sub === 'teaching' || sub === 'preprint' ? sub : 'other' };
  }
}

/** Запись .bib → данные для схемы коллекции publications */
export function normalize(e: BibEntry) {
  const f = e.fields;
  const date = opt(f.date);
  const year = opt(f.year) ?? date?.slice(0, 4);
  return {
    entry_type: e.type,
    ...kindOf(e),
    lang: LANGID[f.langid?.trim() ?? ''],
    year: year && /^\d{4}$/.test(year) ? Number(year) : undefined,
    date,
    authors: people(f.author),
    authors_en: people(f.author_en),
    author_order_todo: f.author_order?.trim() === 'TODO',
    title: opt(f.title),
    title_ru: opt(f.title_ru),
    title_en: opt(f.title_en),
    journal: opt(f.journal ?? f.journaltitle),
    journal_en: opt(f.journal_en),
    booktitle: opt(f.booktitle),
    booktitle_en: opt(f.booktitle_en),
    institution: opt(f.institution ?? f.school),
    publisher: opt(f.publisher),
    address: opt(f.address ?? f.location),
    volume: opt(f.volume),
    number: opt(f.number ?? f.issue),
    pages: opt(f.pages),
    eid: opt(f.eid),
    thesis_type: e.type.endsWith('thesis') ? opt(f.type) : undefined,
    holder: opt(f.holder),
    holder_en: opt(f.holder_en),
    note: opt(f.note),
    note_ru: opt(f.note_ru),
    note_en: opt(f.note_en),
    issn: list(f.issn),
    isbn: opt(f.isbn),
    doi: opt(f.doi),
    url: opt(f.url),
    eprint: opt(f.eprint),
    eprinttype: opt(f.eprinttype)?.toLowerCase(),
    // Переводные версии: related = {ключ}, relatedtype = {translationof | translationas}
    related: list(f.related),
    relatedtype: opt(f.relatedtype)?.toLowerCase(),
    abstract: opt(f.abstract),
    abstract_ru: opt(f.abstract_ru),
    abstract_en: opt(f.abstract_en),
    translation: opt(f.translation),
    tags: list(f.keywords),
    indexing: list(f.indexing).map((s) => s.toLowerCase()),
    elibrary: opt(f.elibrary),
    fulltext: opt(f.fulltext),
    citation_ru: opt(f.citation_ru),
    citation_en: opt(f.citation_en),
    bibtex: serializeClean(e, SITE_ONLY),
  };
}

export function bibtexLoader(opts: { path: string }): Loader {
  return {
    name: 'bibtex-loader',
    load: async ({ store, parseData, generateDigest, logger, watcher, config }) => {
      const file = resolve(fileURLToPath(config.root), opts.path);
      const sync = async () => {
        const entries = parseBibtex(await readFile(file, 'utf8'), opts.path);
        store.clear();
        for (const e of entries) {
          const unknown = Object.keys(e.fields).filter((k) => !STANDARD.has(k) && !SITE_ONLY.has(k));
          if (unknown.length) logger.warn(`${opts.path}:${e.line} «${e.key}»: незнакомые поля ${unknown.join(', ')}`);
          const raw = normalize(e);
          // undefined не храним: схема видит только заполненные поля
          const data = Object.fromEntries(Object.entries(raw).filter(([, v]) => v !== undefined));
          const parsed = await parseData({ id: e.key, data });
          store.set({ id: e.key, data: parsed, digest: generateDigest(data) });
        }
        logger.info(`publications.bib: ${entries.length} записей`);
      };
      await sync();
      watcher?.add(file);
      watcher?.on('change', async (changed) => {
        if (resolve(changed) === file) await sync();
      });
    },
  };
}
