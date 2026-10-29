// Сегодня: тренировки дня, вода, серия, совет.
import { get, post } from '../api.js';
import { h, icon, ring, localDate, fmtDay, WD_FULL, plural, toast, store } from '../ui.js';
import { sessionRow, SLOT } from '../components.js';

export async function render(ctx) {
  const date = localDate();
  const t = await get('/api/today?date=' + date);
  const wd = WD_FULL[(new Date().getDay() + 6) % 7];
  const root = h('div', { class: 'stack' });

  root.append(h('header', { class: 'page-head' },
    h('div', { class: 'row between' },
      h('p', { class: 'muted', text: `${wd}, ${fmtDay(date)}` }),
      h('span', { class: 'tag now row', style: { gap: '4px' } }, icon('flame', 14), `${t.streak} ${plural(t.streak, ['день', 'дня', 'дней'])}`)),
    h('h1', { text: `Привет, ${ctx.user.name}` })));

  // главная карточка: первая несделанная тренировка дня
  const next = t.sessions.find((s) => !s.done);
  if (next) {
    root.append(h('a', { class: 'hero', href: `#/workout/${next.ref}` },
      h('span', { class: 'eyebrow' }, icon(SLOT[next.slot].icon, 16), `${SLOT[next.slot].label}, дальше по плану`),
      h('h2', { text: next.title }),
      h('div', { class: 'meta' }, h('span', null, icon('clock', 16), `${next.minutes} мин`), h('span', null, icon('dumbbell', 16), `${next.count} упр.`)),
      h('span', { class: 'go-btn' }, icon('play', 18), 'Начать')));
  } else {
    root.append(h('div', { class: 'hero rest' },
      h('span', { class: 'eyebrow' }, icon('check', 16), t.sessions.length ? 'На сегодня всё' : 'День отдыха'),
      h('h2', { text: t.sessions.length ? 'Сделано. Красавчик' : 'Сегодня без тренировок' }),
      h('p', { class: 'muted', text: 'Мышцы растут, пока ты отдыхаешь. Пей воду, ешь нормально и ложись вовремя.' }),
      h('div', { class: 'row wrap' },
        h('a', { class: 'btn sm', href: '#/plan', text: 'План недели' }),
        h('a', { class: 'btn sm', href: '#/builder', text: 'Своя тренировка' }))));
  }

  if (next?.home) {
    root.append(h('p', { class: 'small muted' }, 'Дождь или негде тренироваться? ',
      h('a', { href: `#/workout/${next.home}`, text: 'Сделать дома (план Б)' })));
  }

  // подсказка новичку: пока не нажал «Понятно», висит наверху
  if (!store.get('howto-done', false)) {
    const steps = [
      ['play', 'Жми «Начать»', 'Таймер сам ведёт по упражнениям и отдыху.'],
      ['book', 'Не знаешь, как делать?', 'Открой упражнение: там схема, шаги и ошибки.'],
      ['home', 'Негде или дождь?', 'Нажми «План Б» или отметь в профиле «Очень тесно».'],
      ['check', 'В конце сохрани отчёт', 'Тренировка засчитается в план и серию.'],
    ];
    const box = h('section', { class: 'panel howto stack tight', 'aria-label': 'Как пользоваться' },
      h('div', { class: 'row between' }, h('h3', { text: 'Как тут всё устроено' }),
        h('button', { class: 'btn quiet sm', 'aria-label': 'Скрыть подсказку', onclick: () => { store.set('howto-done', true); box.remove(); } }, icon('x', 18))),
      h('ul', { class: 'howto-list' }, steps.map(([ic, t, p]) =>
        h('li', null, h('span', { class: 'ic' }, icon(ic, 20)), h('div', null, h('b', { text: t }), h('p', { class: 'small muted', text: p }))))),
      h('button', { class: 'btn sm primary', onclick: () => { store.set('howto-done', true); box.remove(); }, text: 'Понятно' }));
    root.append(box);
  }

  // полоса недели
  const plan = await get('/api/plan?today=' + date);
  root.append(h('nav', { class: 'week', 'aria-label': 'Неделя' }, plan.days.map((d) =>
    h('a', { href: '#/plan', class: d.isToday ? 'today' : '' },
      WD_FULL[d.weekday - 1].slice(0, 2),
      h('b', { text: Number(d.date.slice(8)) }),
      h('span', { class: 'dots' }, d.sessions.map((s) => h('i', { class: (s.slot === 'morning' ? 'm' : 'e') + (s.done ? ' done' : '') })))))));

  // остальные тренировки дня
  if (t.sessions.length) {
    root.append(h('section', { class: 'stack tight', 'aria-label': 'Тренировки на сегодня' },
      h('p', { class: 'label', text: 'Сегодня' }), ...t.sessions.map(sessionRow)));
  }

  // вода
  let ml = t.water.ml;
  const target = t.water.target;
  const r = ring({ size: 120, stroke: 12, value: ml / target });
  const mlEl = h('div', { class: 'num', style: { fontSize: '30px', lineHeight: '1' }, text: ml });
  const hint = h('p', { class: 'small muted' });
  const showHint = () => {
    hint.textContent = ml >= target ? 'Норма выполнена.' : `Осталось ${target - ml} мл`;
  };
  showHint();
  async function add(delta) {
    try {
      const res = await post('/api/water', { date, delta });
      ml = res.ml;
      mlEl.textContent = ml;
      r.set(ml / target);
      showHint();
      if (delta > 0 && ml >= target && ml - delta < target) toast('Норма воды выполнена!');
    } catch (e) { toast(e.message, 'error'); }
  }
  root.append(h('section', { class: 'panel', 'aria-label': 'Вода' },
    h('div', { class: 'water-row' },
      h('div', { class: 'ring-wrap' }, r.el, h('div', { class: 'center' }, icon('drop', 20), mlEl, h('span', { class: 'small muted', text: 'мл' }))),
      h('div', { class: 'stack tight grow' },
        h('h3', { text: `Вода: норма ${target} мл` }),
        hint,
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn sm primary', onclick: () => add(250), text: '+250' }),
          h('button', { class: 'btn sm', onclick: () => add(500), text: '+500' }),
          h('button', { class: 'btn sm quiet', onclick: () => add(-250), 'aria-label': 'Убрать 250 мл', text: '-250' }))))));

  // серия
  root.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('div', { class: 'big', text: t.streak }), h('div', { class: 'small muted', text: `${plural(t.streak, ['день', 'дня', 'дней'])} подряд` })),
    h('div', { class: 'stat' }, h('div', { class: 'big', text: t.sessions.filter((s) => s.done).length + '/' + t.sessions.length }), h('div', { class: 'small muted', text: 'сегодня сделано' })),
    h('a', { class: 'stat', href: '#/timer', style: { textDecoration: 'none' } }, h('div', { class: 'big' }, icon('clock', 36)), h('div', { class: 'small muted', text: 'таймер' }))));

  root.append(h('a', { class: 'promo', href: '#/drills' },
    h('span', { class: 'tile' }, icon('ball', 28)),
    h('div', { class: 'body' }, h('div', { class: 'title', text: 'Школа мяча' }), h('div', { class: 'small', text: 'Дриблинг, контроль, финты, футзал. Каждое упражнение со схемой.' })),
    h('div', { class: 'go' }, icon('next', 24))));
  root.append(h('aside', { class: 'panel flat paint' }, h('p', { class: 'label', text: 'Совет дня' }), h('p', { text: t.tip })));

  // урок дня: каждый день другой, чтобы Школу замечали
  const { items } = await get('/api/lessons');
  const lesson = items[Math.floor(Date.now() / 86400000) % items.length];
  root.append(h('section', { class: 'stack tight' },
    h('p', { class: 'label', text: 'Урок дня' }),
    h('a', { class: 'session', href: '#/lesson/' + lesson.id },
      h('span', { class: 'tile' }, icon('book', 26)),
      h('div', { class: 'body' }, h('div', { class: 'title', text: lesson.title }), h('div', { class: 'small muted', text: lesson.summary })),
      h('div', { class: 'go' }, icon('next', 24)))));
  return root;
}
