// Школа мяча и школа бокса: все упражнения по разделам, у каждого схема, шаги, ошибки и видео.
import { get } from '../api.js';
import { h, icon, store } from '../ui.js';
import { pageHead, exerciseDetail, exerciseTags, backLink, SPACE } from '../components.js';

const BOX_STYLE_NAME = { soviet: 'Советская школа', american: 'Американская школа', mexican: 'Мексиканская школа', cuban: 'Кубинская школа' };

const unit = (e) => (e.kind === 'time' ? 'сек' : 'повт.');

function card(e) {
  return h('details', { class: 'ex-card' },
    h('summary', null,
      h('span', { class: 'nm col' }, h('b', { text: e.name }), h('span', { class: 'meta small muted', text: [SPACE[e.space]?.label, e.school].filter(Boolean).join(' · ') })),
      h('span', { class: 'amt', text: `${e.amount} ${unit(e)}` }),
      h('span', { class: 'chev' }, icon('next', 18))),
    h('div', { class: 'ex-body stack tight' },
      h('p', { class: 'tip', text: e.tip }),
      exerciseTags(e),
      exerciseDetail(e)));
}

export async function render(ctx) {
  const box = ctx.params && ctx.params[0] === 'box';
  const { cats, hidden, tight, style } = await get('/api/drills' + (box ? '?sport=box' : ''));
  const catKey = box ? 'box-cat' : 'drill-cat';
  let active = store.get(catKey, 'all');
  if (active !== 'all' && !cats.some((c) => c.key === active)) active = 'all';
  const total = cats.reduce((n, c) => n + c.items.length, 0);
  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Разделы школы мяча' });
  const list = h('div', { class: 'stack' });

  const draw = () => {
    chips.replaceChildren(...[{ key: 'all', label: 'Все' }, ...cats].map((c) =>
      h('button', { type: 'button', class: 'chip', role: 'tab', 'aria-selected': String(c.key === active), onclick: () => { active = c.key; store.set(catKey, active); draw(); } }, c.label)));
    list.replaceChildren(...cats.filter((c) => active === 'all' || c.key === active).map((c) =>
      h('section', { class: 'stack tight' },
        h('div', null, h('h2', { text: c.label }), h('p', { class: 'small muted', text: c.text })),
        c.items.map(card))));
  };
  draw();

  const note = hidden
    ? h('p', { class: 'small muted' }, `Ещё ${hidden} упр. скрыто: им нужно больше места или оборудование. `, h('a', { href: '#/profile', text: 'Поменять в профиле' }))
    : null;
  return h('div', { class: 'stack' },
    backLink('#/school', 'Школа'),
    pageHead(box ? 'Школа бокса' : 'Школа мяча', `${total} упражнений ${tight ? 'для комнаты 1×1 м' : 'под твоё место и оборудование'}. Нажми на упражнение: как делать, фото, видео и ошибки.${box ? ` Твой стиль: ${BOX_STYLE_NAME[style]}.` : ''}`),
    chips, list, note);
}
