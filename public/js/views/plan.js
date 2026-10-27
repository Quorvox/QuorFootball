// График недели: утро и вечер по дням, отметка выполненных.
import { get } from '../api.js';
import { h, WD_FULL, fmtShort, localDate } from '../ui.js';
import { sessionRow, pageHead } from '../components.js';
import { LEVEL_OPTIONS } from '../forms.js';

export async function render() {
  const plan = await get('/api/plan?today=' + localDate());
  const lvl = LEVEL_OPTIONS.find((l) => l.value === plan.level.key);
  const all = plan.days.flatMap((d) => d.sessions);
  const root = h('div', { class: 'stack' },
    pageHead('План недели', `Уровень «${plan.level.label}». Сделано ${all.filter((s) => s.done).length} из ${all.length}.`),
    h('div', { class: 'row wrap' },
      h('a', { class: 'btn sm', href: '#/library', text: 'Все тренировки по группам' }),
      h('a', { class: 'btn sm', href: '#/profile', text: 'Сменить уровень' }),
      h('a', { class: 'btn sm', href: '#/builder', text: 'Добавить свою тренировку' })));

  for (const d of plan.days) {
    root.append(h('section', { class: 'stack tight' },
      h('div', { class: 'day-head' },
        h('h3', { text: WD_FULL[d.weekday - 1] }),
        h('span', { class: 'muted small', text: fmtShort(d.date) }),
        d.isToday ? h('span', { class: 'tag now', text: 'сегодня' }) : null),
      d.sessions.length ? d.sessions.map(sessionRow) : h('p', { class: 'muted small', text: 'Свободный день. Вода, сон, прогулка.' })));
  }
  root.append(h('p', { class: 'hint', text: 'Пропустил тренировку? Она переедет на ближайший день без тренировок, а если свободных дней нет, то на свободное утро или вечер. Старше трёх дней уже не догоняем.' }));
  if (lvl) root.append(h('p', { class: 'hint', text: lvl.text }));
  return root;
}
