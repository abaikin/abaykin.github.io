#!/usr/bin/env node
// Проверки перед коммитом и деплоем (npm run validate):
//  1) номера телефонов — в файлах репозитория и в собранном сайте dist/
//     (текст PDF — через pdftotext, если он установлен);
//  2) приватные файлы (ForCLAUDE/, FromClaude/, DRAFT.MD, proposal.md) не попали в git;
//  3) в src/i18n/ru.json и en.json одинаковые ключи.
// Сами номера здесь не хранятся: поиск идёт по шаблону российского номера.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const TEXT = new Set([
  '.astro', '.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.yaml', '.yml', '.md', '.mdx',
  '.css', '.html', '.xml', '.txt', '.bib', '.svg', '.csv', '.ipynb',
]);
// package-lock.json — хеши; сам скрипт содержит шаблоны поиска
const SKIP = new Set(['package-lock.json', 'validate.mjs']);
// +7 или 8, затем 10 цифр группами 3-3-2-2 через пробелы, точки, дефисы или скобки
const PHONE =
  /(?:\+7|(?<![\d.])8)[\s.\-‐-―()]*\d{3}[\s.\-‐-―()]*\d{3}[\s.\-‐-―]*\d{2}[\s.\-‐-―]*\d{2}(?!\d)/g;
const TEL = /\btel:/i;

let problems = 0;
const fail = (msg) => {
  problems++;
  console.error(`✗ ${msg}`);
};
const ok = (msg) => console.log(`✓ ${msg}`);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// -z: пути без экранирования (иначе git кавычит имена с кириллицей и файл «теряется»)
const git = (...args) =>
  execFileSync('git', [...args, '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean);

const repoFiles = git('ls-files', '--cached', '--others', '--exclude-standard');
for (const f of repoFiles) {
  // удалённый, но ещё не закоммиченный файл — не ошибка; остальное должно читаться
  if (!existsSync(f) && !git('ls-files', '--deleted').includes(f)) fail(`${f}: файл из git не найден на диске`);
}
const distFiles = existsSync('dist') ? walk('dist') : [];
const files = [...new Set([...repoFiles, ...distFiles])].filter((f) => existsSync(f) && !SKIP.has(basename(f)));

// 1. Номера телефонов
let textCount = 0;
const pdfs = [];
for (const f of files) {
  const ext = extname(f).toLowerCase();
  if (ext === '.pdf') {
    pdfs.push(f);
    continue;
  }
  if (!TEXT.has(ext)) continue;
  const text = readFileSync(f, 'utf8');
  textCount++;
  const found = text.match(PHONE);
  if (found) fail(`${f}: похоже на номер телефона (${found.length} шт.)`);
  if (TEL.test(text)) fail(`${f}: ссылка tel:`);
}
const hasPdftotext = !spawnSync('pdftotext', ['-v']).error;
let pdfCount = 0;
if (hasPdftotext) {
  for (const f of pdfs) {
    const r = spawnSync('pdftotext', ['-q', f, '-'], { encoding: 'utf8' });
    if (r.status !== 0) {
      fail(`${f}: не удалось прочитать PDF`);
      continue;
    }
    pdfCount++;
    const found = r.stdout.match(PHONE);
    if (found) fail(`${f}: в тексте PDF похоже на номер телефона (${found.length} шт.)`);
  }
} else if (pdfs.length) {
  console.warn(`! pdftotext не найден: ${pdfs.length} PDF не проверены на номера телефонов`);
}
ok(`на номера телефонов проверено: ${textCount} текстовых файлов, ${pdfCount} PDF`);

// 2. Приватные файлы не в git
// FromClaude/ — оригиналы документов до затирания подписей и номеров (см. CLAUDE.md)
const leaked = git('ls-files').filter(
  (f) => f.startsWith('ForCLAUDE/') || f.startsWith('FromClaude/') || f === 'DRAFT.MD' || f === 'proposal.md',
);
if (leaked.length) fail(`в git попали приватные файлы: ${leaked.join(', ')}`);
else ok('приватные файлы (ForCLAUDE/, FromClaude/, DRAFT.MD, proposal.md) не в git');

// 3. Ключи словарей интерфейса
const ru = JSON.parse(readFileSync('src/i18n/ru.json', 'utf8'));
const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
const noEn = Object.keys(ru).filter((k) => !(k in en));
const noRu = Object.keys(en).filter((k) => !(k in ru));
if (noEn.length) fail(`в en.json нет ключей: ${noEn.join(', ')}`);
if (noRu.length) fail(`в ru.json нет ключей: ${noRu.join(', ')}`);
if (!noEn.length && !noRu.length) ok(`словари ru/en согласованы (${Object.keys(ru).length} ключей)`);

if (problems) {
  console.error(`\nНайдено проблем: ${problems}`);
  process.exit(1);
}
console.log('\nВсё в порядке.');
