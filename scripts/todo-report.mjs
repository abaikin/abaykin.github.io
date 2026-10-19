#!/usr/bin/env node
// Список пробелов в данных — строки со значением или пометкой TODO (npm run todo)
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOTS = ['src/data', 'src/content'];
const EXT = new Set(['.yaml', '.yml', '.json', '.md', '.mdx', '.bib']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let total = 0;
for (const root of ROOTS.filter((r) => existsSync(r))) {
  for (const file of walk(root).sort()) {
    if (!EXT.has(extname(file))) continue;
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        if (/\bTODO\b/.test(line)) {
          total++;
          console.log(`${file}:${i + 1}: ${line.trim()}`);
        }
      });
  }
}
console.log(`\nВсего пометок TODO: ${total}. Общий список задач — в TODO.md.`);
