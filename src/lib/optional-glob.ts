// glob() из astro/loaders, который молчит, пока в папке нет ни одного файла.
// Нужен для разделов, которые наполняются позже (выступления: src/content/talks/).
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'astro/loaders';
import type { Loader } from 'astro/loaders';

export function optionalGlob(opts: { base: string; extension: string }): Loader {
  const inner = glob({ pattern: `*${opts.extension}`, base: opts.base });
  return {
    name: 'optional-glob',
    load: async (ctx) => {
      const dir = resolve(fileURLToPath(ctx.config.root), opts.base);
      const any = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(opts.extension));
      if (!any) {
        ctx.store.clear();
        return;
      }
      return inner.load(ctx);
    },
  };
}
