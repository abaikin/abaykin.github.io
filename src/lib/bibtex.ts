// Небольшой разборщик BibTeX без внешних зависимостей.
// Поддерживает: значения в {…} и "…", числа, макросы месяцев и @string, склейку через #,
// @comment и @preamble. Текст вне записей считается комментарием.
// Ошибки сообщают номер строки и ключ записи, чтобы их было легко найти в файле.

export interface BibEntry {
  /** Тип записи в нижнем регистре: article, inproceedings, patent, software, thesis … */
  type: string;
  key: string;
  /** Поля в порядке следования в файле; значения — как в файле (LaTeX не раскрыт) */
  fields: Record<string, string>;
  line: number;
}

const MONTHS: Record<string, string> = {
  jan: '1', feb: '2', mar: '3', apr: '4', may: '5', jun: '6',
  jul: '7', aug: '8', sep: '9', oct: '10', nov: '11', dec: '12',
};

export function parseBibtex(src: string, file = 'publications.bib'): BibEntry[] {
  const strings: Record<string, string> = { ...MONTHS };
  const entries: BibEntry[] = [];
  const keys = new Set<string>();
  let i = 0;

  const lineAt = (pos: number) => src.slice(0, pos).split('\n').length;
  const fail = (msg: string, pos = i): never => {
    throw new Error(`${file}:${lineAt(pos)}: ${msg}`);
  };
  const skipWs = () => {
    while (i < src.length && /\s/.test(src[i])) i++;
  };
  const ident = () => {
    const m = /^[A-Za-z0-9_:\-.+/']+/.exec(src.slice(i));
    if (!m) return fail(`ожидалось имя, а встретилось «${src.slice(i, i + 20)}»`);
    i += m[0].length;
    return m[0];
  };
  // Содержимое {…} с учётом вложенных скобок; i стоит на «{»
  const braced = () => {
    const start = i;
    let depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        i++;
        return src.slice(start + 1, i - 1);
      }
    }
    return fail('не закрыта фигурная скобка «{»', start);
  };
  const quoted = () => {
    const start = i++;
    let depth = 0;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '"' && depth === 0) {
        i++;
        return src.slice(start + 1, i - 1);
      }
    }
    return fail('не закрыта кавычка «"»', start);
  };
  // Значение поля: части, склеенные через #
  const value = (): string => {
    let out = '';
    for (;;) {
      skipWs();
      const c = src[i];
      if (c === '{') out += braced();
      else if (c === '"') out += quoted();
      else if (/[0-9]/.test(c)) out += ident();
      else {
        const name = ident().toLowerCase();
        if (!(name in strings)) fail(`неизвестный макрос «${name}» (нужны фигурные скобки?)`);
        out += strings[name];
      }
      skipWs();
      if (src[i] !== '#') return out;
      i++;
    }
  };

  while (i < src.length) {
    const at = src.indexOf('@', i);
    if (at < 0) break;
    i = at + 1;
    const start = at;
    const type = ident().toLowerCase();
    skipWs();
    const open = src[i];
    if (open !== '{' && open !== '(') fail(`после @${type} ожидалась «{»`);
    const close = open === '{' ? '}' : ')';
    if (type === 'comment') {
      if (open === '{') braced();
      else i = src.indexOf(')', i) + 1;
      continue;
    }
    i++;
    skipWs();
    if (type === 'preamble') {
      value();
      skipWs();
      if (src[i] !== close) fail('ожидалось окончание @preamble');
      i++;
      continue;
    }
    if (type === 'string') {
      const name = ident().toLowerCase();
      skipWs();
      if (src[i] !== '=') fail('в @string ожидался знак «=»');
      i++;
      strings[name] = value();
      skipWs();
      if (src[i] !== close) fail('ожидалось окончание @string');
      i++;
      continue;
    }
    const key = ident();
    if (keys.has(key)) fail(`ключ «${key}» уже встречался`, start);
    keys.add(key);
    const fields: Record<string, string> = {};
    for (;;) {
      skipWs();
      if (src[i] === close) {
        i++;
        break;
      }
      if (src[i] !== ',') fail(`в записи «${key}» ожидалась запятая или конец записи`);
      i++;
      skipWs();
      if (src[i] === close) {
        i++;
        break;
      }
      const name = ident().toLowerCase();
      skipWs();
      if (src[i] !== '=') fail(`в записи «${key}» после поля «${name}» ожидался знак «=»`);
      i++;
      if (name in fields) fail(`в записи «${key}» поле «${name}» повторяется`);
      fields[name] = value().trim();
    }
    entries.push({ type, key, fields, line: lineAt(start) });
  }
  return entries;
}

// ---------- LaTeX → Unicode ----------

const ACCENTS: Record<string, string> = {
  "'": '́', '`': '̀', '^': '̂', '"': '̈', '~': '̃', '=': '̄',
  '.': '̇', u: '̆', v: '̌', H: '̋', c: '̧', k: '̨', r: '̊',
};
const SYMBOLS: Record<string, string> = {
  ss: 'ß', o: 'ø', O: 'Ø', ae: 'æ', AE: 'Æ', oe: 'œ', OE: 'Œ', aa: 'å', AA: 'Å', l: 'ł', L: 'Ł', i: 'ı',
  textendash: '–', textemdash: '—', textquoteleft: '‘', textquoteright: '’', textquotedblleft: '“',
  textquotedblright: '”', guillemotleft: '«', guillemotright: '»', textnumero: '№', dots: '…', ldots: '…',
};

/** Текст без формул: экранирование, акценты, тире, неразрывные пробелы; защитные скобки убираются */
function plainTex(s: string): string {
  return s
    .replace(/\\([%&_#$])/g, '$1')
    .replace(/\\([`'^"~=.])\s*\{?\s*\\?([A-Za-z])\s*\}?/g, (_, a: string, ch: string) => (ch + ACCENTS[a]).normalize('NFC'))
    .replace(/\\([uvHckr])\s*\{\s*\\?([A-Za-z])\s*\}/g, (_, a: string, ch: string) => (ch + ACCENTS[a]).normalize('NFC'))
    .replace(/\\(?:textit|emph|textbf|textsc|textrm|textup|textsf|mbox|text|url)\s*\{([^{}]*)\}/g, '$1')
    .replace(/\\([A-Za-z]+)\b\s*(\{\})?/g, (m, name: string) => SYMBOLS[name] ?? m)
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/~/g, ' ')
    .replace(/[{}]/g, '');
}

/** Части строки: обычный текст и формулы $…$ (\$ — просто знак доллара) */
export function splitMath(s: string): { math: boolean; text: string }[] {
  const out: { math: boolean; text: string }[] = [];
  let buf = '';
  let math = false;
  for (let k = 0; k < s.length; k++) {
    const c = s[k];
    if (c === '\\' && s[k + 1] === '$') {
      buf += '\\$';
      k++;
    } else if (c === '$') {
      if (buf) out.push({ math, text: buf });
      buf = '';
      math = !math;
    } else buf += c;
  }
  if (buf) out.push({ math, text: buf });
  return out;
}

/** Значение поля как обычный текст (формулы остаются в виде $…$) */
export function texToText(s: string): string {
  return splitMath(s)
    .map((p) => (p.math ? `$${p.text}$` : plainTex(p.text)))
    .join('')
    .replace(/[ \t\r\f\v]*\n[ \t\r\f\v]*\n\s*/g, '\n\n')
    .replace(/[ \t\r\f\v]*\n(?!\n)[ \t\r\f\v]*/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------- «Чистый» BibTeX для скачивания ----------

/** Значение отсутствует или помечено как пробел в данных */
export const isTodo = (v: string | undefined) => v === undefined || v.trim() === '' || /^TODO\b/.test(v.trim());

/** Запись без служебных полей сайта и без пометок TODO */
export function serializeClean(e: BibEntry, siteOnly: ReadonlySet<string>): string {
  const rows = Object.entries(e.fields).filter(([k, v]) => !siteOnly.has(k) && !isTodo(v));
  const width = Math.max(...rows.map(([k]) => k.length));
  return `@${e.type}{${e.key},\n${rows.map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`).join(',\n')}\n}\n`;
}
