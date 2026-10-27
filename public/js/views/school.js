// Школа: уроки по мячу, силе и тренировкам дома.
import { get } from '../api.js';
import { h, icon, store } from '../ui.js';
import { pageHead } from '../components.js';

const GROUPS = [
  ['ball', 'Футбольная техника', 'Мяч, чеканка, удары, пас, ведение'],
  ['strength', 'Сила с нуля', 'Отжимания, подтягивания, пресс по ступеням'],
  ['home', 'Дома', 'Как тренироваться безопасно'],
];

export async function render() {
  const { items } = await get('/api/lessons');
  const root = h('div', { class: 'stack' }, pageHead('Школа', 'Учись шаг за шагом. Каждый урок можно сразу потренировать.'));
  for (const [key, title, sub] of GROUPS) {
    const list = items.filter((l) => l.group === key);
    if (!list.length) continue;
    root.append(h('section', { class: 'stack tight' },
      h('div', null, h('h2', { text: title }), h('p', { class: 'muted small', text: sub })),
      list.map((l) => {
        const done = store.get('lesson-' + l.id, []).length;
        return h('a', { class: 'session ' + (key === 'strength' ? '' : 'evening'), href: '#/lesson/' + l.id },
          h('span', { class: 'tile' }, icon(key === 'strength' ? 'dumbbell' : key === 'home' ? 'home' : 'ball', 26)),
          h('div', { class: 'body' },
            h('div', { class: 'when', text: `${l.level}, ${l.minutes} мин` }),
            h('div', { class: 'title', text: l.title }),
            h('div', { class: 'small muted', text: l.summary }),
            done ? h('div', { class: 'small', text: `Пройдено ступеней: ${done}` }) : null),
          h('div', { class: 'go' }, icon('next', 24)));
      })));
  }
  return root;
}
