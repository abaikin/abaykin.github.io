// Вывод выступлений: даты, авторы, темы, порядок в списке. Данные — коллекции talks и conferences.
import type { CollectionEntry } from 'astro:content';
import { DATE_LOCALE, type Lang } from '../i18n';
import { type Name, type Pub, parseName, translit } from './publications';

export type Talk = CollectionEntry<'talks'>;
export type TalkData = Talk['data'];
export type Conference = CollectionEntry<'conferences'>;

export const talkYear = (d: TalkData) => Number(d.date.slice(0, 4));

const utc = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
};

/**
 * Дата в строке выступления, без года (год — в заголовке раздела):
 * «9 сентября», «8–15 сентября» (известны только даты мероприятия), «июль»; только год — undefined.
 */
export function talkDate(d: TalkData, lang: Lang): string | undefined {
  const [, month, day] = d.date.split('-');
  if (!month) return undefined;
  const locale = DATE_LOCALE[lang];
  if (!day) return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(utc(d.date));
  const fmt = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' });
  if (!d.date_end) return fmt.format(utc(d.date));
  // «10 – 17 March» (en-GB, с тонкими пробелами) → «10–17 March», как в русском «10–17 марта»
  return fmt.formatRange(utc(d.date), utc(d.date_end)).replace(/(\d)\s*–\s*(\d)/, '$1–$2');
}

/** Авторы на языке страницы: из файла выступления или из первой связанной публикации */
export function talkAuthors(d: TalkData, pubs: Pub[], lang: Lang): Name[] {
  const first = pubs[0]?.data;
  const [names, namesEn] = d.authors.length ? [d.authors, d.authors_en] : first ? [first.authors, first.authors_en] : [[], []];
  if (lang === 'en') {
    if (namesEn.length) return namesEn.map(parseName);
    return names.map((a) => {
      const n = parseName(a);
      return { family: translit(n.family), given: translit(n.given) };
    });
  }
  return names.map(parseName);
}

/** Темы: из файла выступления, а если их нет — из связанных публикаций */
export function talkTags(d: TalkData, pubs: Pub[]): string[] {
  const own = d.tags.map((tag) => tag.id);
  return own.length ? own : [...new Set(pubs.flatMap((p) => p.data.tags.map((tag) => tag.id)))];
}

const STATUS_ORDER: Record<TalkData['status'], number> = { plenary: 0, invited: 1, oral: 2, short: 3, poster: 4, TODO: 5 };

/** Порядок в списке: новые выше; в один день — пленарные и приглашённые первыми; без точной даты — в конце своего года */
export function compareTalks(a: Talk, b: Talk): number {
  return (
    b.data.date.localeCompare(a.data.date) ||
    STATUS_ORDER[a.data.status] - STATUS_ORDER[b.data.status] ||
    a.id.localeCompare(b.id)
  );
}
