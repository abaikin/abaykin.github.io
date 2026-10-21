// Вывод проектов, курсов и лаборатории: период, подписи ссылок и технологий, подробный текст на языке страницы.
import { getCollection, type CollectionEntry } from 'astro:content';
import { type Lang, isFilled, otherLang, t } from '../i18n';
import { formatPartialDate, formatPeriod } from './experience';

/**
 * Период проекта или курса: «2019 — по н. в.», «2019–2022». Без начала (или TODO) — undefined (на странице «будет добавлено»).
 * Завершённое без конца — только год начала.
 */
export function entryPeriod(
  d: { start?: string; end?: string; status?: string },
  lang: Lang,
): string | undefined {
  if (!d.start || !isFilled(d.start)) return d.end ? formatPartialDate(d.end, lang) : undefined;
  if (!d.end && (d.status === 'completed' || d.status === 'archived')) return formatPartialDate(d.start, lang);
  return formatPeriod(d.start, d.end, lang, t(lang, 'common.present'));
}

/** Подпись ссылки: label_<lang>, затем подпись на другом языке, затем общая label */
export function linkLabel(l: { label?: string; label_ru?: string; label_en?: string; url: string }, lang: Lang): string {
  const rec = l as Record<string, string | undefined>;
  return rec[`label_${lang}`] ?? rec[`label_${otherLang(lang)}`] ?? l.label ?? new URL(l.url).hostname;
}

/** Название технологии: общая строка или { ru, en } */
export const techLabel = (tech: string | { ru: string; en: string }, lang: Lang) =>
  typeof tech === 'string' ? tech : tech[lang];

/** Часы курса: «72 ч», «32 ч лекций, 32 ч практики»; TODO или нет — undefined */
export function hoursLabel(
  h: number | 'TODO' | { total?: number; lectures?: number; practice?: number } | undefined,
  lang: Lang,
): string | undefined {
  if (h === undefined || h === 'TODO') return undefined;
  if (typeof h === 'number') return t(lang, 'courses.hoursValue', { n: h });
  const parts = [
    h.total !== undefined && t(lang, 'courses.hoursValue', { n: h.total }),
    h.lectures !== undefined && t(lang, 'courses.hoursLectures', { n: h.lectures }),
    h.practice !== undefined && t(lang, 'courses.hoursPractice', { n: h.practice }),
  ].filter((s): s is string => typeof s === 'string');
  return parts.length ? parts.join(', ') : undefined;
}

type TextCollection = 'projectTexts' | 'courseTexts';

// Файлы подробных текстов: без них не обращаемся к коллекции (getCollection пустой коллекции пишет предупреждение в лог)
const TEXT_FILES: Record<TextCollection, string[]> = {
  projectTexts: Object.keys(import.meta.glob('/src/content/projects/*/{ru,en}.{md,mdx}')),
  courseTexts: Object.keys(import.meta.glob('/src/content/courses/*/{ru,en}.{md,mdx}')),
};

/**
 * Подробный текст записи (src/content/<раздел>/<slug>/ru.mdx, en.mdx) на языке страницы, а если его нет — на другом.
 * fallback: true — показан текст на другом языке.
 */
export async function entryText<C extends TextCollection>(collection: C, slug: string, lang: Lang) {
  if (!TEXT_FILES[collection].some((f) => f.includes(`/${slug}/`))) return undefined;
  const texts = (await getCollection(collection)) as CollectionEntry<C>[];
  const own = texts.find((e) => e.id === `${slug}/${lang}`);
  if (own) return { entry: own, lang, fallback: false };
  const alt = otherLang(lang);
  const other = texts.find((e) => e.id === `${slug}/${alt}`);
  return other ? { entry: other, lang: alt, fallback: true } : undefined;
}
