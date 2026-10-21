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

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
// YAML превращает 2025-09-09 в дату, а 2025 — в число; кавычки писать не нужно, приводим к строке
const dateText = (re: RegExp, message: string) =>
  z.preprocess(
    (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? String(v) : v),
    z.string().regex(re, message),
  );
/** Дата с точностью до года, месяца или дня: 2019, 2019-09, 2019-09-01 */
const anyDate = (field: string) => dateText(/^\d{4}(-\d{2}(-\d{2})?)?$/, `${field}: 2019, 2019-09 или 2019-09-01`);

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
    // Подразделение: факультет, кафедра (строкой под организацией)
    unit_ru: text.optional(),
    unit_en: text.optional(),
    honors: z.boolean().default(false),
    thesis_title_ru: text,
    thesis_title_en: text,
    supervisor_ru: text,
    supervisor_en: text,
    abstract_ru: text,
    abstract_en: text,
    defense_url: z.url().optional(),
    // Где прошла защита (если не там, где учился): диссертационный совет
    council_ru: text.optional(),
    council_en: text.optional(),
    // PDF внутри public/assets/: работа, автореферат (для кандидатской), скан диплома
    pdf: text.optional(),
    autoreferat_pdf: text.optional(),
    diploma_pdf: text.optional(),
    // Связанные работы: ключи из publications.bib и id выступлений
    publications: z.array(reference('publications')).default([]),
    talks: z.array(reference('talks')).default([]),
    translation,
  }),
});

// ---------- Общие поля проектов, курсов и лаборатории ----------

/** Ссылка: общая подпись label или подписи на двух языках label_ru / label_en */
const link = z
  .strictObject({ label: text.optional(), label_ru: text.optional(), label_en: text.optional(), url: z.url() })
  .refine((l) => l.label || l.label_ru || l.label_en, 'ссылка: нужна подпись label (или label_ru / label_en)');
const youtubeId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, 'идентификатор ролика YouTube (11 символов)');
/** Ролик YouTube (встраивается с youtube-nocookie.com по нажатию) */
const video = z.strictObject({
  youtube: youtubeId,
  title_ru: text.optional(),
  title_en: text.optional(),
  date: anyDate('date').optional(),
});
/** Документ или материал: файл внутри public/assets/ (file: pdf/…) или внешняя ссылка (url) */
const material = z
  .strictObject({
    title_ru: text.optional(),
    title_en: text.optional(),
    kind: z.enum(['pdf', 'slides', 'book', 'code', 'notebook', 'data', 'link']).default('pdf'),
    file: text.optional(),
    url: z.url().optional(),
    translation,
  })
  .refine((m) => m.title_ru || m.title_en, 'материал: нужно title_ru или title_en')
  .refine((m) => m.file || m.url, 'материал: нужен file (внутри public/assets/) или url');
/** Технология: общее название («C++», «FreeFEM») или пара { ru, en } («Метод конечных элементов») */
const technology = z.union([text, z.strictObject({ ru: text, en: text })]);
/** Начало периода: 2019, 2019-09, 2019-09-01 или TODO */
const startDate = z.union([z.literal('TODO'), anyDate('start')]);

/** Проекты: src/content/projects/<slug>/meta.yaml; подробный текст — рядом, ru.mdx и/или en.mdx (коллекция projectTexts) */
const projects = defineCollection({
  loader: glob({
    pattern: '*/meta.yaml',
    base: './src/content/projects',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: ({ image }) =>
    z.strictObject({
      order: z.number().int().default(100),
      icon: text.default('folder'),
      title_ru: text,
      title_en: text,
      role_ru: text,
      role_en: text,
      summary_ru: text,
      summary_en: text,
      status: z.enum(['active', 'completed']).default('active'),
      start: startDate.optional(),
      end: anyDate('end').optional(),
      // Организация: заказчик, правообладатель или площадка проекта
      org_ru: text.optional(),
      org_en: text.optional(),
      org_url: z.url().optional(),
      technologies: z.array(technology).default([]),
      links: z.array(link).default([]),
      cover: image().optional(),
      cover_alt_ru: text.optional(),
      cover_alt_en: text.optional(),
      gallery: z
        .array(
          z.strictObject({
            src: image(),
            alt_ru: text,
            alt_en: text.optional(),
            caption_ru: text.optional(),
            caption_en: text.optional(),
          }),
        )
        .default([]),
      videos: z.array(video).default([]),
      documents: z.array(material).default([]),
      tags: z.array(reference('tags')).default([]),
      // Связанные работы: ключи из publications.bib и id выступлений (имя файла в src/content/talks/)
      publications: z.array(reference('publications')).default([]),
      talks: z.array(reference('talks')).default([]),
      // Опыт работы и гранты ссылаются на проект сами (поле projects в work.yaml и funding.yaml)
      translation,
    }),
});

/** Подробные тексты проектов: src/content/projects/<slug>/ru.mdx, en.mdx (id: '<slug>/ru'). Формулы, картинки, видео */
const projectTexts = defineCollection({
  loader: optionalGlob({ base: './src/content/projects', pattern: '*/{ru,en}.{md,mdx}', match: /^(ru|en)\.mdx?$/ }),
  schema: z.object({ translation }),
});

/** Лаборатория: src/data/laboratory.yaml. status: coming-soon — заглушка («Скоро»), active — полная страница */
const laboratory = defineCollection({
  loader: glob({ pattern: 'laboratory.yaml', base: './src/data' }),
  schema: z.strictObject({
    name_ru: text,
    name_en: text,
    org_ru: text,
    org_en: text,
    org_url: z.url(),
    unit_ru: text.optional(),
    unit_en: text.optional(),
    since: year,
    status: z.enum(['coming-soon', 'active']),
    icon: text.default('flask-conical'),
    role_ru: text,
    role_en: text,
    short_ru: text,
    short_en: text,
    // Полное описание: абзацы через пустую строку
    description_ru: text.optional(),
    description_en: text.optional(),
    directions: z
      .array(
        z.strictObject({
          title_ru: text,
          title_en: text,
          text_ru: text.optional(),
          text_en: text.optional(),
          icon: text.optional(),
          tags: z.array(reference('tags')).default([]),
        }),
      )
      .default([]),
    projects: z.array(reference('projects')).default([]),
    partners: z.array(z.strictObject({ name_ru: text, name_en: text, url: z.url().optional() })).default([]),
    // Сотрудники — только с их согласия (решение владельца: пока не публикуем)
    people: z
      .array(
        z.strictObject({
          name_ru: text,
          name_en: text,
          role_ru: text.optional(),
          role_en: text.optional(),
          url: z.url().optional(),
        }),
      )
      .default([]),
    links: z.array(link).default([]),
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

// ---------- Опыт: src/data/experience/*.yaml (ключи — id записей) ----------

/** Опыт работы: work.yaml. Нет end — работа по настоящее время. results — «полученные результаты» */
const work = defineCollection({
  loader: file('src/data/experience/work.yaml'),
  schema: z.strictObject({
    start: anyDate('start'),
    end: anyDate('end').optional(),
    // main — основное место, part-time — по совместительству, internship — стажировка; не знаем — не пишем
    kind: z.enum(['main', 'part-time', 'internship']).optional(),
    position_ru: text,
    position_en: text,
    org_ru: text,
    org_en: text,
    org_url: z.url().optional(),
    unit_ru: optText,
    unit_en: optText,
    city_ru: optText,
    city_en: optText,
    duties_ru: z.array(text).default([]),
    duties_en: z.array(text).default([]),
    results_ru: z.array(text).default([]),
    results_en: z.array(text).default([]),
    projects: z.array(reference('projects')).default([]),
    tags: z.array(reference('tags')).default([]),
    note_ru: optText,
    note_en: optText,
    translation,
  }),
});

/** Проекты и гранты: funding.yaml. role: leader — руководитель, participant — исполнитель */
const funding = defineCollection({
  loader: file('src/data/experience/funding.yaml'),
  schema: z
    .strictObject({
      kind: z.enum(['grant', 'scholarship', 'contract', 'program']).default('grant'),
      number: optText,
      // Номер латиницей для английской страницы (если в оригинале кириллица: СП-… → SP-…)
      number_en: optText,
      funder_ru: text,
      funder_en: text,
      title_ru: optText,
      title_en: optText,
      start: anyDate('start'),
      end: anyDate('end').optional(),
      role: z.enum(['leader', 'participant', 'TODO']).default('TODO'),
      url: z.url().optional(),
      publications: z.array(reference('publications')).default([]),
      projects: z.array(reference('projects')).default([]),
      tags: z.array(reference('tags')).default([]),
      note_ru: optText,
      note_en: optText,
      translation,
    })
    .refine((f) => f.title_ru || f.title_en, 'нужно title_ru или title_en'),
});

/** Дополнительное образование: training.yaml. certificate — PDF внутри public/assets/ */
const training = defineCollection({
  loader: file('src/data/experience/training.yaml'),
  schema: z
    .strictObject({
      kind: z.enum(['qualification', 'course', 'intensive', 'lectures', 'other']).default('course'),
      title_ru: optText,
      title_en: optText,
      provider_ru: text,
      provider_en: optText,
      provider_url: z.url().optional(),
      start: anyDate('start').optional(),
      end: anyDate('end'),
      hours: z.number().int().positive().optional(),
      description_ru: optText,
      description_en: optText,
      certificate: optText,
      tags: z.array(reference('tags')).default([]),
      translation,
    })
    .refine((c) => c.title_ru || c.title_en, 'нужно title_ru или title_en'),
});

/** Навыки: skills.yaml — два списка, technical и management */
const skill = z.strictObject({ ru: text, en: text });
const skills = defineCollection({
  loader: glob({ pattern: 'skills.yaml', base: './src/data/experience' }),
  schema: z.strictObject({
    technical: z.array(skill).default([]),
    management: z.array(skill).default([]),
    translation,
  }),
});

/**
 * Достижения: achievements.yaml. kind: letter — благодарственное письмо, award — документ о достижении
 * (награда, премия, стипендия, конкурс). pdf — скан внутри public/assets/; talk и funding — связанные записи.
 */
const achievements = defineCollection({
  loader: file('src/data/experience/achievements.yaml'),
  schema: z.strictObject({
    kind: z.enum(['letter', 'award']),
    date: z.union([z.literal('TODO'), anyDate('date')]),
    title_ru: text,
    title_en: text,
    issuer_ru: optText,
    issuer_en: optText,
    pdf: optText,
    talk: reference('talks').optional(),
    funding: reference('funding').optional(),
    note_ru: optText,
    note_en: optText,
    translation,
  }),
});

/** Студенты: src/content/students/<id>.yaml, один файл на работу студента */
const students = defineCollection({
  loader: optionalGlob({ base: './src/content/students', extension: '.yaml' }),
  schema: z.strictObject({
    name_ru: text,
    name_en: optText,
    work: z.enum(['coursework', 'bachelor', 'master', 'specialist', 'phd', 'TODO']).default('TODO'),
    year: yearOrTodo,
    status: z.enum(['defended', 'in-progress', 'TODO']).default('TODO'),
    org_ru: optText,
    org_en: optText,
    title_ru: optText,
    title_en: optText,
    abstract_ru: optText,
    abstract_en: optText,
    pdf: optText,
    publications: z.array(reference('publications')).default([]),
    talks: z.array(reference('talks')).default([]),
    tags: z.array(reference('tags')).default([]),
    translation,
  }),
});

// ---------- Курсы: src/content/courses/<slug>/meta.yaml (+ ru.mdx / en.mdx — аннотация, программа, литература) ----------

/** Часы: число, { total, lectures, practice } или TODO */
const hours = z.union([
  z.literal('TODO'),
  z.number().int().positive(),
  z.strictObject({
    total: z.number().int().positive().optional(),
    lectures: z.number().int().positive().optional(),
    practice: z.number().int().positive().optional(),
  }),
]);
/** Лекция программы: номер, тема, дата, лектор, видео YouTube, слайды и ноутбук (файлы внутри public/assets/), код */
const lecture = z
  .strictObject({
    n: z.number().int().positive().optional(),
    title_ru: optText,
    title_en: optText,
    date: anyDate('date').optional(),
    lecturer_ru: optText,
    lecturer_en: optText,
    video: youtubeId.optional(),
    slides: optText,
    notebook: optText,
    code: z.url().optional(),
  })
  .refine((l) => l.title_ru || l.title_en, 'лекция: нужно title_ru или title_en');

/**
 * kind: lectures — лекционный курс, lectures-practice — лекции и практика, seminars — семинары,
 * mini-course — мини-курс, continuing-education — программа ДПО. language — язык преподавания.
 * Поля по решению владельца: аннотация (summary + текст), для кого (audience), когда читался (start / end / schedule),
 * часы (hours), программа (lectures или текст), соавторы (co_lecturers), язык (language), форма контроля (assessment).
 */
const courses = defineCollection({
  loader: optionalGlob({
    base: './src/content/courses',
    pattern: '*/meta.yaml',
    match: /^meta\.yaml$/,
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.strictObject({
    order: z.number().int().default(100),
    icon: text.default('book-open'),
    title_ru: text,
    title_en: text,
    kind: z.enum(['lectures', 'lectures-practice', 'seminars', 'mini-course', 'continuing-education']),
    status: z.enum(['active', 'archived']).default('active'),
    role_ru: text,
    role_en: text,
    org_ru: text,
    org_en: text,
    org_url: z.url().optional(),
    unit_ru: optText,
    unit_en: optText,
    audience_ru: optText,
    audience_en: optText,
    start: startDate.optional(),
    end: anyDate('end').optional(),
    schedule_ru: optText,
    schedule_en: optText,
    hours: hours.optional(),
    language: z.enum(['ru', 'en']),
    co_lecturers_ru: z.array(text).default([]),
    co_lecturers_en: z.array(text).default([]),
    assessment_ru: optText,
    assessment_en: optText,
    summary_ru: text,
    summary_en: text,
    // Пояснение под заголовком «Программа»: какой год, чего нет в записи
    programme_note_ru: optText,
    programme_note_en: optText,
    lectures: z.array(lecture).default([]),
    materials: z.array(material).default([]),
    videos: z.array(video).default([]),
    links: z.array(link).default([]),
    tags: z.array(reference('tags')).default([]),
    publications: z.array(reference('publications')).default([]),
    translation,
  }),
});

/** Подробные тексты курсов: src/content/courses/<slug>/ru.mdx, en.mdx (id: '<slug>/ru') */
const courseTexts = defineCollection({
  loader: optionalGlob({ base: './src/content/courses', pattern: '*/{ru,en}.{md,mdx}', match: /^(ru|en)\.mdx?$/ }),
  schema: z.object({ translation }),
});

export const collections = {
  profile,
  education,
  work,
  funding,
  training,
  skills,
  achievements,
  students,
  projects,
  projectTexts,
  courses,
  courseTexts,
  laboratory,
  tags,
  publications,
  journals,
  pubsources,
  conferences,
  talks,
};
