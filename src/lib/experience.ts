// Вывод раздела «Опыт»: даты и периоды, порядок записей, двуязычные списки. Данные — src/data/experience/*.yaml.
import { DATE_LOCALE, type Lang, isFilled, otherLang } from '../i18n';

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};
const isYear = (iso: string) => /^\d{4}$/.test(iso);

/** Дата с точностью до года, месяца или дня: «2019», «май 2019», «26 марта 2018» (en: «May 2019», «26 March 2018») */
export function formatPartialDate(iso: string, lang: Lang): string {
  if (isYear(iso)) return iso;
  const withDay = iso.length > 7;
  return new Intl.DateTimeFormat(DATE_LOCALE[lang], {
    ...(withDay ? { day: 'numeric' } : {}),
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(utc(iso))
    .replace(/\s*г\.$/, '');
}

/**
 * Период: «2012–2014», «2019 — по н. в.», «26 марта 2018 — 31 декабря 2019».
 * Нет end — по настоящее время (present); нет start — только конец.
 */
export function formatPeriod(start: string | undefined, end: string | undefined, lang: Lang, present: string): string {
  const s = start && isFilled(start) ? formatPartialDate(start, lang) : '';
  const e = end ? formatPartialDate(end, lang) : present;
  if (!s || s === e) return e;
  return start && end && isYear(start) && isYear(end) ? `${s}–${e}` : `${s} — ${e}`;
}

/** Новые выше: по началу периода, а если его нет — по концу (YYYY, YYYY-MM, YYYY-MM-DD сравниваются как текст) */
export function byStartDesc(a: { data: { start?: string; end?: string } }, b: { data: { start?: string; end?: string } }) {
  const key = (x: { start?: string; end?: string }) => (x.start && isFilled(x.start) ? x.start : (x.end ?? ''));
  return key(b.data).localeCompare(key(a.data)) || (b.data.end ?? '9999').localeCompare(a.data.end ?? '9999');
}

/** Список `${field}_ru` / `${field}_en` на языке страницы, а если пуст — на другом языке; пометки TODO отбрасываются */
export function locList(entry: object, field: string, lang: Lang): { items: string[]; lang: Lang } {
  const rec = entry as Record<string, unknown>;
  const pick = (l: Lang) => ((rec[`${field}_${l}`] as string[] | undefined) ?? []).filter(isFilled);
  const own = pick(lang);
  if (own.length) return { items: own, lang };
  return { items: pick(otherLang(lang)), lang: otherLang(lang) };
}
