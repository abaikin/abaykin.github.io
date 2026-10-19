// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

// Пользовательский сайт GitHub Pages (репозиторий abaikin.github.io), поэтому base не нужен.
// Внутренние ссылки строятся через src/lib/site.ts (учитывают import.meta.env.BASE_URL).
export default defineConfig({
  site: 'https://abaikin.github.io',
  trailingSlash: 'always',
  // В Astro 7 по умолчанию 'jsx': пробелы между строчными элементами удаляются
  compressHTML: true,
  i18n: {
    locales: ['ru', 'en'],
    defaultLocale: 'ru',
    routing: { prefixDefaultLocale: true, redirectToDefaultLocale: false },
  },
  markdown: {
    // Плагины KaTeX работают только с Unified (в Astro 7 по умолчанию стоит Sätteri)
    processor: unified({ remarkPlugins: [remarkMath], rehypePlugins: [rehypeKatex] }),
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
  },
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => page !== 'https://abaikin.github.io/',
      i18n: { defaultLocale: 'ru', locales: { ru: 'ru-RU', en: 'en-US' } },
    }),
  ],
  // Source Sans 3 — текст и заголовки (без засечек), IBM Plex Mono — код и служебные подписи.
  // У обоих есть кириллица. Шрифт заголовков задаётся токеном --font-heading в global.css.
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Source Sans 3',
      cssVariable: '--font-source-sans',
      weights: ['200 900'],
      styles: ['normal', 'italic'],
      subsets: ['latin', 'cyrillic'],
      fallbacks: ['system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: [400, 500],
      styles: ['normal'],
      subsets: ['latin', 'cyrillic'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
  vite: { plugins: [tailwindcss()] },
});
