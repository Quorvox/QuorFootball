// Куски интерфейса, которые нужны на нескольких экранах.
import { h, icon } from './ui.js';
import { PHOTOS } from './photos.js';

export const SLOT = {
  morning: { label: 'Утро', icon: 'sun' },
  evening: { label: 'Вечер', icon: 'moon' },
};

export function sessionRow(s) {
  const slot = SLOT[s.slot];
  return h('a', { class: `session ${s.slot}${s.done ? ' done' : ''}`, href: `#/workout/${s.ref}` },
    h('span', { class: 'tile' }, icon(slot.icon, 26)),
    h('div', { class: 'body' },
      h('div', { class: 'when' }, slot.label, s.time ? `, ${s.time}` : null, s.custom ? h('span', { class: 'tag', text: 'своя' }) : null, s.moved && !s.done ? h('span', { class: 'tag now', text: 'перенесена' }) : null, s.missed ? h('span', { class: 'tag', text: 'пропущена' }) : null),
      h('div', { class: 'title', text: s.title }),
      h('div', { class: 'small muted', text: `${s.minutes} мин, ${s.count} упр.` })),
    h('div', { class: 'go' }, s.done ? h('span', { class: 'badge-ok', 'aria-label': 'Сделано' }, icon('check', 20)) : icon('next', 24)));
}

export function pageHead(title, sub) {
  return h('header', { class: 'page-head' }, h('h1', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null);
}

export function backLink(href, text = 'Назад') {
  return h('a', { class: 'btn quiet sm', href }, icon('back', 18), text);
}

// карточки выбора (радио)
export function choiceGroup(name, options, value, { two = false } = {}) {
  return h('div', { class: 'choices' + (two ? ' two' : ''), role: 'radiogroup' },
    options.map((o) =>
      h('label', { class: 'choice' },
        h('input', { type: 'radio', name, value: o.value, checked: o.value === value }),
        h('span', { class: 'box' }, h('b', { text: o.title }), o.text ? h('span', { class: 'small muted', text: o.text }) : null))));
}

export function field(id, label, input, hint) {
  return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('span', { class: 'hint', text: hint }) : null);
}

export const checked = (root, name) => root.querySelector(`input[name="${name}"]:checked`)?.value;

// схемы лежат в /img/lessons/*.svg, вставляем как есть, чтобы работали цвета темы
const svgCache = new Map();
export function figure(name) {
  if (name.startsWith('photo:')) return photo(PHOTOS[name.slice(6)]);
  const box = h('figure', { class: 'figure' });
  (async () => {
    try {
      let svg = svgCache.get(name);
      if (!svg) {
        const r = await fetch(`/img/lessons/${encodeURIComponent(name)}.svg`);
        if (!r.ok) return box.remove();
        svg = await r.text();
        svgCache.set(name, svg);
      }
      box.insertAdjacentHTML('afterbegin', svg);
    } catch { box.remove(); }
  })();
  return box;
}

// фото с подписью: автор и лицензия обязательны
function photo(p) {
  if (!p) return h('span');
  const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer', text });
  return h('figure', { class: 'figure photo' },
    h('img', { src: p.src, alt: p.alt, loading: 'lazy' }),
    h('figcaption', { class: 'small muted' }, p.text, ' Фото: ', link(p.page, p.author), ', ', link(p.licenseUrl, p.license), ', Wikimedia Commons.'));
}

// видео грузим только после клика: до этого YouTube ничего про тебя не знает
export function videoBlock(v) {
  const wrap = h('div', { class: 'video' });
  const play = () => wrap.replaceChildren(h('iframe', {
    src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.yt)}?rel=0`,
    title: v.title, loading: 'lazy', allowfullscreen: true,
    allow: 'encrypted-media; picture-in-picture', referrerpolicy: 'strict-origin-when-cross-origin',
    sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups',
  }));
  wrap.append(
    h('button', { class: 'video-btn', type: 'button', onclick: play },
      icon('play', 30), h('span', { class: 'video-title', text: v.title }), h('span', { class: 'small muted', text: `${v.channel}. При нажатии откроется YouTube` })),
    h('a', { class: 'small', href: `https://www.youtube.com/watch?v=${encodeURIComponent(v.yt)}`, target: '_blank', rel: 'noopener noreferrer', text: 'Открыть на YouTube' }));
  return wrap;
}

export const youtubeSearch = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

// как делать упражнение: шаги, ошибки, схема
export function exerciseDetail(e) {
  return h('div', { class: 'stack tight' },
    e.steps?.length ? h('ol', { class: 'steps-list' }, e.steps.map((s) => h('li', { text: s }))) : null,
    e.mistakes?.length ? h('div', null, h('p', { class: 'label', text: 'Частые ошибки' }), h('ul', { class: 'mistakes' }, e.mistakes.map((m) => h('li', { text: m })))) : null,
    e.fig ? figure(e.fig) : null);
}
