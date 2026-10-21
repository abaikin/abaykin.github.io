// Раскрывающиеся панели со встроенными PDF и видео — общие для «Публикаций», «Выступлений» и «Опыта».
//   button[data-toggle][aria-controls] — раскрыть/свернуть панель; подписи — data-label-open / data-label-close
//                                        (текст меняется внутри [data-label]);
//   [data-embed="pdf"]     — iframe с PDF (data-src, data-title) создаётся при первом открытии; на телефонах не встраиваем:
//                            там встроенный просмотр работает плохо, остаётся кнопка «Открыть / скачать»;
//   [data-embed="youtube"] — плеер youtube-nocookie.com (data-id) создаётся при открытии и удаляется при закрытии,
//                            чтобы свёрнутое видео не играло в фоне.

/** Слушать нажатия на кнопки [data-toggle] внутри root */
export function bindPanels(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    const toggle = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-toggle]');
    if (!toggle || !root.contains(toggle)) return;
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    const label = toggle.querySelector('[data-label]');
    if (label) label.textContent = (open ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ?? label.textContent;
    if (!panel) return;
    panel.hidden = !open;
    if (open) panel.querySelectorAll<HTMLElement>('[data-embed]').forEach(embed);
    else panel.querySelectorAll<HTMLElement>('[data-embed="youtube"]').forEach((box) => box.replaceChildren());
  });
}

function embed(box: HTMLElement) {
  if (box.querySelector('iframe')) return;
  const kind = box.dataset.embed;
  if (kind === 'pdf') {
    if (!matchMedia('(min-width: 768px)').matches) return;
    const frame = document.createElement('iframe');
    frame.src = `${box.dataset.src}#view=FitH`;
    frame.title = box.dataset.title ?? '';
    frame.loading = 'lazy';
    box.prepend(frame);
  } else if (kind === 'youtube') {
    const frame = document.createElement('iframe');
    frame.src = `https://www.youtube-nocookie.com/embed/${box.dataset.id}?autoplay=1&rel=0`;
    frame.title = box.dataset.title ?? '';
    frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    box.replaceChildren(frame);
  }
}
