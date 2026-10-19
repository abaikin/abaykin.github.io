import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Lang } from '../i18n';

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, '');

export const SITE_REPO = 'https://github.com/abaikin/abaikin.github.io';

/** Путь внутри сайта с учётом base: href('/ru/') */
export const href = (path: string) => `${BASE}${path.startsWith('/') ? path : `/${path}`}`;

/** Страница на языке: langHref('ru', 'talks/') → '/ru/talks/' */
export const langHref = (lang: Lang, path = '') => href(`/${lang}/${path}`.replace(/\/{2,}/g, '/'));

/** Путь страницы без base и языкового префикса: '/ru/talks/' → 'talks/' */
export function pagePath(pathname: string): string {
  const p = BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname;
  return p.replace(/^\/(?:ru|en)(?:\/|$)/, '');
}

/** Публичный файл: asset('cv/x.pdf') → '/assets/cv/x.pdf' */
export const asset = (rel: string) => href(`/assets/${rel}`);

/** Лежит ли файл в public/assets. Кнопки к отсутствующим файлам не показываем. */
export const assetExists = (rel: string) => existsSync(join(process.cwd(), 'public', 'assets', rel));

/** Иконки и подписи профилей; id совпадают с profile.yaml → profiles[].id */
export const PROFILES: Record<string, { icon: string; label: Record<Lang, string> }> = {
  researchgate: { icon: 'si:researchgate', label: { ru: 'ResearchGate', en: 'ResearchGate' } },
  sciact: { icon: 'lucide:flask-conical', label: { ru: 'SciAct (ИГиЛ СО РАН)', en: 'SciAct (Lavrentyev Institute)' } },
  orcid: { icon: 'si:orcid', label: { ru: 'ORCID', en: 'ORCID' } },
  elibrary: { icon: 'lucide:library', label: { ru: 'eLibrary (РИНЦ)', en: 'eLibrary (RSCI)' } },
  scopus: { icon: 'si:scopus', label: { ru: 'Scopus', en: 'Scopus' } },
  wos: { icon: 'si:clarivate', label: { ru: 'Web of Science', en: 'Web of Science' } },
  github: { icon: 'si:github', label: { ru: 'GitHub', en: 'GitHub' } },
  linkedin: { icon: 'si:linkedin', label: { ru: 'LinkedIn', en: 'LinkedIn' } },
  youtube: { icon: 'si:youtube', label: { ru: 'YouTube: «Вычислительная механика»', en: 'YouTube channel' } },
  'nsu-pure': { icon: 'lucide:landmark', label: { ru: 'Исследовательский портал НГУ', en: 'NSU research portal' } },
  instagram: { icon: 'si:instagram', label: { ru: 'Instagram', en: 'Instagram' } },
};
