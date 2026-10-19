import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { bibtexLoader } from './lib/bibtex-loader';
import { optionalGlob } from './lib/optional-glob';

// Пометка пробела в данных: значение 'TODO' (см. npm run todo)
const text = z.string().min(1);
const year = z.number().int().min(1900).max(2100);
const yearOrTodo = z.union([year, z.literal('TODO')]);
const translation = z.enum(['auto', 'human']).optional();

/** Страница «Обо мне»: src/data/profile.yaml */
const profile = defineCollection({
  loader: glob({ pattern: 'profile.yaml', base: './src/data' }),
  schema: ({ image }) =>
    z.object({
      name_ru: text,
      name_en: text,
      alt_names: z.array(text).default([]),
      position_ru: text,
      position_en: text,
      affiliation_ru: text,
      affiliation_en: text,
      affiliation_url: z.url(),
      degree_ru: text,
      degree_en: text,
      photo: image(),
      bio_ru: text,
      bio_en: text,
      translation,
      // strictObject: лишний ключ (например, из-за запятой в { … } без кавычек) — ошибка сборки
      emails: z.array(z.strictObject({ kind: z.enum(['work', 'personal']), address: z.email() })),
      interests: z.array(z.strictObject({ ru: text, en: text, tag: reference('tags').optional() })),
      profiles: z.array(z.strictObject({ id: text, url: z.url() })),
      cv: z.strictObject({ ru: text, en: text }),
      doing: z.array(
        z.union([z.strictObject({ project: reference('projects') }), z.strictObject({ page: z.literal('lab') })]),
      ),
    }),
});

/** Образование: src/data/experience/education.yaml (ключи — id записей) */
const education = defineCollection({
  loader: file('src/data/experience/education.yaml'),
  schema: z.object({
    level: z.enum(['bachelor', 'master', 'phd']),
    start: yearOrTodo,
    end: year,
    defense_date: z.coerce.date().optional(),
    degree_ru: text,
    degree_en: text,
    program_ru: text,
    program_en: text,
    org_ru: text,
    org_en: text,
    org_short_ru: text,
    org_short_en: text,
    org_url: z.url().optional(),
    honors: z.boolean().default(false),
    thesis_title_ru: text,
    thesis_title_en: text,
    supervisor_ru: text,
    supervisor_en: text,
    abstract_ru: text,
    abstract_en: text,
    defense_url: z.url().optional(),
    pdf: text.optional(),
    translation,
  }),
});

/** Проекты: src/content/projects/<slug>/meta.yaml (+ необязательные ru.mdx / en.mdx) */
const projects = defineCollection({
  loader: glob({
    pattern: '*/meta.yaml',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.object({
      order: z.number().int().default(100),
      icon: text.default('folder'),
      title_ru: text,
      title_en: text,
      role_ru: text,
      role_en: text,
      summary_ru: text,
      summary_en: text,
      status: z.enum(['active', 'completed']).default('active'),
      start: yearOrTodo.optional(),
      end: year.optional(),
      links: z.array(z.strictObject({ label: text, url: z.url() })).default([]),
      cover: image().optional(),
      tags: z.array(reference('tags')).default([]),
      // Связанные работы: ключи из publications.bib и id выступлений (имя файла в src/content/talks/)
      publications: z.array(reference('publications')).default([]),
      talks: z.array(reference('talks')).default([]),
      translation,
    }),
});

/** Лаборатория: src/data/laboratory.yaml (пока заглушка, сотрудников не публикуем) */
const laboratory = defineCollection({
  loader: glob({ pattern: 'laboratory.yaml', base: './src/data' }),
  schema: z.object({
    name_ru: text,
    name_en: text,
    org_ru: text,
    org_en: text,
    org_url: z.url(),
    since: year,
    status: z.enum(['coming-soon', 'active']),
    icon: text.default('flask-conical'),
    role_ru: text,
    role_en: text,
    short_ru: text,
    short_en: text,
    translation,
  }),
});

/** Справочник тегов: src/data/tags.yaml (ключ → подписи RU/EN) */
const tags = defineCollection({
  loader: file('src/data/tags.yaml'),
  schema: z.strictObject({
    ru: text,
    en: text,
    group: z.enum(['topic', 'method', 'software', 'activity']).default('topic'),
  }),
});

const optText = text.optional();

/**
 * Публикации: src/data/publications.bib (разбор — src/lib/bibtex-loader.ts).
 * Здесь проверяются уже разобранные записи: язык, год, DOI, теги, индексация.
 */
const publications = defineCollection({
  loader: bibtexLoader({ path: 'src/data/publications.bib' }),
  schema: z.strictObject({
    entry_type: text,
    category: z.enum(['journal', 'conference', 'rid', 'other']),
    kind: z.enum(['article', 'proceedings', 'abstract', 'patent', 'software', 'thesis', 'preprint', 'teaching', 'other']),
    lang: z.enum(['ru', 'en'], { message: 'langid: укажите {russian} или {english}' }),
    year: year,
    date: z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'date: формат 2024-01-12').optional(),
    authors: z.array(text).min(1, 'author: нужен хотя бы один автор'),
    authors_en: z.array(text).default([]),
    author_order_todo: z.boolean(),
    title: text,
    title_ru: optText,
    title_en: optText,
    journal: optText,
    journal_en: optText,
    booktitle: optText,
    booktitle_en: optText,
    institution: optText,
    publisher: optText,
    address: optText,
    volume: optText,
    number: optText,
    pages: optText,
    eid: optText,
    thesis_type: optText,
    holder: optText,
    holder_en: optText,
    note: optText,
    note_ru: optText,
    note_en: optText,
    issn: z.array(z.string().regex(/^\d{4}-\d{3}[\dX]$/, 'issn: формат 1234-567X')).default([]),
    isbn: optText,
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/, 'doi: формат 10.xxxx/…, без https://doi.org/').optional(),
    url: z.url().optional(),
    eprint: optText,
    eprinttype: z.enum(['arxiv', 'ssrn']).optional(),
    related: z.array(reference('publications')).default([]),
    relatedtype: z.enum(['translationof', 'translationas']).optional(),
    abstract: optText,
    abstract_ru: optText,
    abstract_en: optText,
    translation,
    tags: z.array(reference('tags')).default([]),
    indexing: z.array(z.enum(['wos', 'scopus', 'rinc', 'rinc-core', 'rsci'])).default([]),
    elibrary: z.string().regex(/^\d+$/, 'elibrary: номер статьи в eLibrary (цифры)').optional(),
    fulltext: optText,
    citation_ru: optText,
    citation_en: optText,
    bibtex: text,
  }),
});

/** Журналы: категория ВАК и уровень «Белого списка» по ISSN — src/data/journals.yaml */
const journals = defineCollection({
  loader: file('src/data/journals.yaml'),
  schema: z
    .strictObject({
      name_ru: optText,
      name_en: optText,
      issn: z.array(z.string().regex(/^\d{4}-\d{3}[\dX]$/)).default([]),
      vak: z.enum(['K1', 'K2', 'K3']).optional(),
      vak_basis: z.enum(['list', 'equated']).optional(),
      white_list: z.number().int().min(1).max(4).optional(),
      white_list_year: year.optional(),
    })
    .refine((j) => j.issn.length > 0 || j.name_ru || j.name_en, 'нужен issn или название журнала'),
});

/** Источники данных о публикациях (кнопка «Источники данных»): src/data/publication-sources.yaml */
const pubsources = defineCollection({
  loader: file('src/data/publication-sources.yaml'),
  schema: z.strictObject({
    order: z.number().int(),
    name_ru: text,
    name_en: text,
    url: z.url(),
    what_ru: text,
    what_en: text,
  }),
});

/** Мероприятия (серии конференций) для фильтра «Мероприятие» на странице выступлений: src/data/conferences.yaml */
const conferences = defineCollection({
  loader: file('src/data/conferences.yaml'),
  schema: z
    .strictObject({
      short_ru: optText,
      short_en: optText,
      name_ru: optText,
      name_en: optText,
      translation,
    })
    .refine((c) => c.short_ru || c.short_en || c.name_ru || c.name_en, 'нужно короткое или полное название'),
});

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
// YAML превращает 2025-09-09 в дату, а 2025 — в число; кавычки писать не нужно, приводим к строке
const dateText = (re: RegExp, message: string) =>
  z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? String(v) : v),
    z.string().regex(re, message),
  );

/**
 * Выступления: src/content/talks/<id>.yaml, один файл на доклад; id (имя файла) — якорь …/talks/#id.
 * date — день доклада; если известны только даты мероприятия: date — первый день, date_end — последний.
 * status — формат: plenary (пленарный), invited (приглашённый), oral (секционный), short (короткое сообщение), poster (стендовый);
 * scope — «охват»: international, national-intl (всероссийская с международным участием), national, unknown (не указано);
 * speaker — выступал ли владелец сайта (true / false — докладывал соавтор / TODO).
 * authors и tags можно не писать: тогда они берутся из первой связанной публикации (publications).
 */
const talks = defineCollection({
  loader: optionalGlob({ base: './src/content/talks', extension: '.yaml' }),
  schema: z
    .strictObject({
      date: dateText(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'date: 2025, 2025-09 или 2025-09-09'),
      date_end: dateText(isoDay, 'date_end: формат 2025-09-11').optional(),
      lang: z.enum(['ru', 'en']),
      title_ru: optText,
      title_en: optText,
      authors: z.array(text).default([]),
      authors_en: z.array(text).default([]),
      conference: reference('conferences'),
      event_ru: optText,
      event_en: optText,
      city_ru: optText,
      city_en: optText,
      url: z.url().optional(),
      program_url: z.url().optional(),
      session_ru: optText,
      session_en: optText,
      status: z.enum(['plenary', 'invited', 'oral', 'short', 'poster', 'TODO']).default('TODO'),
      scope: z.enum(['international', 'national-intl', 'national', 'unknown']).default('unknown'),
      speaker: z.union([z.boolean(), z.literal('TODO')]).default('TODO'),
      abstract_pdf: optText,
      abstract_url: z.url().optional(),
      // страницы в сборнике: 59 или 36–37
      abstract_pages: z.preprocess((v) => (typeof v === 'number' ? String(v) : v), text).optional(),
      slides_pdf: optText,
      slides_url: z.url().optional(),
      video: z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'video: идентификатор ролика YouTube (11 символов)').optional(),
      award_ru: optText,
      award_en: optText,
      award_pdf: optText,
      publications: z.array(reference('publications')).default([]),
      tags: z.array(reference('tags')).default([]),
      note_ru: optText,
      note_en: optText,
      translation,
    })
    .refine((t) => t.title_ru || t.title_en, 'нужно title_ru или title_en')
    .refine((t) => !t.date_end || (isoDay.test(t.date) && t.date_end > t.date), {
      message: 'date_end: нужна полная дата date (2025-09-08), и date_end должна быть позже',
      path: ['date_end'],
    }),
});

export const collections = {
  profile,
  education,
  projects,
  laboratory,
  tags,
  publications,
  journals,
  pubsources,
  conferences,
  talks,
};
