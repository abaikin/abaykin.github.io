import ru from './ru.json';
import en from './en.json';

export const LANGS = ['ru', 'en'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'ru';
export const DATE_LOCALE: Record<Lang, string> = { ru: 'ru-RU', en: 'en-GB' };
export const OG_LOCALE: Record<Lang, string> = { ru: 'ru_RU', en: 'en_US' };

export type UIKey = keyof typeof ru;
// Тип требует, чтобы в en.json были все ключи ru.json (проверяется в npm run check)
const DICTS: Record<Lang, Record<UIKey, string>> = { ru, en };

/** Строка интерфейса; {name} в тексте заменяется значениями vars */
export function t(lang: Lang, key: UIKey, vars?: Record<string, string | number>): string {
  let s = DICTS[lang][key] ?? DICTS[DEFAULT_LANG][key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export const isLang = (v: unknown): v is Lang => (LANGS as readonly unknown[]).includes(v);
export const otherLang = (lang: Lang): Lang => (lang === 'ru' ? 'en' : 'ru');
/** getStaticPaths для страниц src/pages/[lang]/… */
export const langPaths = () => LANGS.map((lang) => ({ params: { lang } }));

/** Значение заполнено (не пусто и не пометка TODO) */
export const isFilled = (v: unknown): v is string =>
  typeof v === 'string' && v.trim() !== '' && v.trim() !== 'TODO';

export interface Localized {
  text: string;
  lang: Lang;
  /** true — показан текст на другом языке, потому что перевода нет */
  fallback: boolean;
}

/** Двуязычное поле `${field}_ru` / `${field}_en` с запасным языком; undefined, если не заполнено */
export function loc(entry: object, field: string, lang: Lang): Localized | undefined {
  const rec = entry as Record<string, unknown>;
  const own = rec[`${field}_${lang}`];
  if (isFilled(own)) return { text: own, lang, fallback: false };
  const alt = otherLang(lang);
  const other = rec[`${field}_${alt}`];
  if (isFilled(other)) return { text: other, lang: alt, fallback: true };
  return undefined;
}
