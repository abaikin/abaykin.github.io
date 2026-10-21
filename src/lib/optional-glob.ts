// glob() из astro/loaders, который молчит, пока в папке нет ни одного подходящего файла.
// Нужен для разделов, которые наполняются позже: выступления, студенты, курсы, подробные тексты проектов.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';

type GlobOptions = Parameters<typeof glob>[0];

interface Options {
  base: string;
  /** Файлы прямо в base с этим расширением ('.yaml' → шаблон '*.yaml') */
  extension?: string;
  /** Или свой шаблон glob ('*\/meta.yaml') и проверка имени файла: есть ли что загружать (поиск на уровень вглубь) */
  pattern?: string;
  match?: RegExp;
  generateId?: GlobOptions['generateId'];
}

/** Есть ли в папке (и на depth уровней глубже) файл, имя которого проходит test */
function hasFile(dir: string, test: (name: string) => boolean, depth: number): boolean {
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return depth > 0 && hasFile(p, test, depth - 1);
    return test(name);
  });
}

export function optionalGlob(opts: Options): Loader {
  const pattern = opts.pattern ?? `*${opts.extension}`;
  const test = opts.match ? (name: string) => opts.match!.test(name) : (name: string) => name.endsWith(opts.extension ?? '');
  const inner = glob({ pattern, base: opts.base, ...(opts.generateId ? { generateId: opts.generateId } : {}) });
  return {
    name: 'optional-glob',
    load: async (ctx) => {
      const dir = resolve(fileURLToPath(ctx.config.root), opts.base);
      if (!hasFile(dir, test, opts.pattern ? 1 : 0)) {
        ctx.store.clear();
        return;
      }
      return inner.load(ctx);
    },
  };
}
