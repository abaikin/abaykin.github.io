// Скачиваемый список публикаций: /publications.bib («чистый» BibTeX без служебных полей сайта)
import { getCollection } from 'astro:content';
import { comparePubs } from '../lib/publications';

export async function GET() {
  const pubs = (await getCollection('publications')).sort(comparePubs);
  const head = [
    '% Publications of Aleksei Baikin / Публикации А. Н. Байкина',
    '% https://abaikin.github.io/ru/publications/',
    `% Records: ${pubs.length}`,
    '',
    '',
  ].join('\n');
  return new Response(head + pubs.map((p) => p.data.bibtex).join('\n'), {
    headers: { 'Content-Type': 'text/x-bibtex; charset=utf-8' },
  });
}
