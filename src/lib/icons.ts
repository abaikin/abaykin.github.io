import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Иконки берутся из наборов Iconify на этапе сборки и встраиваются как inline SVG.
// lucide (ISC) — интерфейс, si = simple-icons (CC0) — бренды профилей.
const SETS: Record<string, string> = {
  lucide: '@iconify-json/lucide/icons.json',
  si: '@iconify-json/simple-icons/icons.json',
};

interface IconSet {
  width?: number;
  height?: number;
  icons: Record<string, { body: string; width?: number; height?: number }>;
  aliases?: Record<string, { parent: string }>;
}

const require = createRequire(import.meta.url);
const cache = new Map<string, IconSet>();

function loadSet(prefix: string): IconSet {
  const cached = cache.get(prefix);
  if (cached) return cached;
  const pkg = SETS[prefix];
  if (!pkg) throw new Error(`Неизвестный набор иконок: ${prefix}`);
  const set = JSON.parse(readFileSync(require.resolve(pkg), 'utf8')) as IconSet;
  cache.set(prefix, set);
  return set;
}

/** name в формате 'lucide:search' или 'si:github'; без префикса — lucide */
export function getIcon(name: string) {
  const [prefix, id] = name.includes(':') ? name.split(':', 2) : ['lucide', name];
  const set = loadSet(prefix);
  const icon = set.icons[id] ?? (set.aliases?.[id] ? set.icons[set.aliases[id].parent] : undefined);
  if (!icon) throw new Error(`Иконка не найдена: ${name}`);
  return { body: icon.body, width: icon.width ?? set.width ?? 24, height: icon.height ?? set.height ?? 24 };
}
