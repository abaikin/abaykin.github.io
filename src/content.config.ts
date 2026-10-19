import { defineCollection, reference } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

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

export const collections = { profile, education, projects, laboratory, tags };
