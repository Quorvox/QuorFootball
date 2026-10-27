// Каталог тренировок по группам: любую можно сделать в любой день, к расписанию они не привязаны.
import { get } from '../api.js';
import { h, icon, store } from '../ui.js';
import { pageHead } from '../components.js';

const GROUP_ICON = { strength: 'dumbbell', speed: 'flame', ball: 'ball', recovery: 'moon' };

export async function render() {
  const { groups } = await get('/api/library');
  let active = store.get('lib-group', 'all');
  if (active !== 'all' && !groups.some((g) => g.key === active)) active = 'all';
  const list = h('div', { class: 'stack' });
  const chips = h('div', { class: 'chips', role: 'tablist', 'aria-label': 'Группы тренировок' });

  const draw = () => {
    chips.replaceChildren(...[{ key: 'all', label: 'Все' }, ...groups].map((g) =>
      h('button', { type: 'button', class: 'chip', role: 'tab', 'aria-selected': String(g.key === active), onclick: () => { active = g.key; store.set('lib-group', active); draw(); } }, g.label)));
    list.replaceChildren(...groups.filter((g) => active === 'all' || g.key === active).map((g) =>
      h('section', { class: 'stack tight' },
        h('div', null, h('h2', { text: g.label }), h('p', { class: 'small muted', text: g.text })),
        g.items.map((w) =>
          h('a', { class: 'session ' + (w.slot === 'evening' ? 'evening' : ''), href: '#/workout/' + w.ref },
            h('span', { class: 'tile' }, icon(GROUP_ICON[g.key], 26)),
            h('div', { class: 'body' },
              h('div', { class: 'title', text: w.title }),
              h('div', { class: 'small muted', text: `${w.minutes} мин, ${w.count} упр.` })),
            h('div', { class: 'go' }, icon('next', 24)))))));
  };
  draw();
  return h('div', { class: 'stack' }, pageHead('Все тренировки', 'Выбери группу и тренируйся, когда удобно.'), chips, list);
}
