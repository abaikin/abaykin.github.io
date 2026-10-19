# abaikin.github.io

Персональный сайт Алексея Николаевича Байкина (RU/EN): https://abaikin.github.io/

Сайт статический: Astro 7 + Tailwind CSS 4, публикуется на GitHub Pages через GitHub Actions.
Список дел, пробелов в данных и решений — в [TODO.md](TODO.md).

## Быстрый старт

Нужен Node.js ≥ 22.22.

```bash
npm install
npm run dev        # http://localhost:4321 (поиск в этом режиме не работает)
```

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | сервер разработки с автообновлением |
| `npm run build` | сборка сайта в `dist/` + индекс поиска Pagefind |
| `npm run preview` | просмотр собранного сайта (поиск работает) |
| `npm run check` | проверка типов и шаблонов (`astro check`) |
| `npm run validate` | проверки: номера телефонов в файлах и в `dist/`, приватные файлы, словари RU/EN |
| `npm run todo` | список пробелов (`TODO`) в данных |

## Как устроено

- Страницы лежат в `src/pages/[lang]/…`: один файл на страницу, версии `/ru/…` и `/en/…` генерируются из него.
- Корень `/` выбирает язык: сохранённый ручной выбор → язык браузера → английский.
- Всё содержимое — в файлах данных, компоненты править не нужно:
  - `src/data/profile.yaml` — «Обо мне»: имя, должность, биография, почта, профили, CV, «Чем занимаюсь»;
  - `src/data/experience/education.yaml` — образование;
  - `src/data/laboratory.yaml` — лаборатория;
  - `src/data/tags.yaml` — справочник тегов (ключ → подписи RU/EN);
  - `src/content/projects/<slug>/meta.yaml` — проекты;
  - `src/i18n/ru.json`, `src/i18n/en.json` — строки интерфейса.
- Файлы для скачивания (PDF, CV) — в `public/assets/`; фото и картинки — в `src/assets/img/` (Astro их сжимает и подбирает размер).
- Цвета — CSS-переменные в `src/styles/global.css` (палитра Hugo Blox Default), шрифты подключаются в `astro.config.mjs`.

### Двуязычные поля

Поле пишется дважды: `title_ru` и `title_en`. Если одного языка нет, сайт покажет второй.
Машинные переводы помечаются `translation: auto`. Незаполненное значение — `TODO`: на сайте появится пометка «будет добавлено».

Внутри фигурных скобок `{ … }` в YAML запятая разделяет поля, поэтому текст с запятой берите в кавычки:
`{ ru: "МКЭ, МКО", en: "FEM, FVM" }`. Если забыть, сборка остановится с ошибкой.

### Как обновить

- **Фото:** заменить `src/assets/img/profile.jpg` (квадрат от 400×400).
- **CV:** положить PDF в `public/assets/cv/` и указать имя в `profile.yaml` → `cv`. Кнопка появляется, только если файл есть.
- **Проект:** создать папку `src/content/projects/<slug>/` с файлом `meta.yaml` (образец — любой существующий проект).
- **Тег:** добавить строку в `src/data/tags.yaml`; ключ латиницей.
- Публикации, выступления, записи блога — инструкции появятся вместе с этими разделами.

## Деплой

Push в `main` → GitHub Actions (`.github/workflows/deploy.yml`) собирает сайт, запускает `npm run validate` и публикует на GitHub Pages.

Однократная настройка репозитория: Settings → Pages → Build and deployment → Source: **GitHub Actions**.

## Приватность

- Номера телефонов не публикуются нигде: `npm run validate` ищет их по шаблону в репозитории и в собранном сайте, и сборка в CI при находке падает.
- `ForCLAUDE/`, `DRAFT.MD` и `proposal.md` — в `.gitignore`.

## Сторонние ресурсы

- Иконки: [Lucide](https://lucide.dev) (ISC), [Simple Icons](https://simpleicons.org) (CC0).
- Шрифты: Source Sans 3, IBM Plex Serif, IBM Plex Mono (SIL Open Font License); скачиваются из Fontsource при сборке и хранятся на сайте.
