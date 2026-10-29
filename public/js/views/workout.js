// Обзор тренировки: что внутри, как делать каждое упражнение, и кнопка «Начать».
import { get, del } from '../api.js';
import { h, icon, toast, WD_FULL } from '../ui.js';
import { SLOT, backLink, exerciseDetail, exerciseTags, whereTag } from '../components.js';

const PHASES = [
  ['warmup', 'Разминка'],
  ['main', 'Основная часть'],
  ['cooldown', 'Заминка и растяжка'],
];

const amountText = (e) => {
  const unit = e.kind === 'time' ? 'сек' : 'повт.';
  return e.sets > 1 ? `${e.sets} × ${e.amount} ${unit}` : `${e.amount} ${unit}`;
};

export async function render(ctx) {
  const ref = ctx.params[0];
  const w = await get('/api/workout/' + encodeURIComponent(ref));
  const slot = SLOT[w.slot];
  const lesson = ref.startsWith('l-');
  const catalog = /^(h-)?s-/.test(ref);
  const isHome = Boolean(w.baseRef);
  const when = lesson ? 'Мини-тренировка по уроку' : catalog ? 'Из каталога, можно в любой день' : `${slot.label}, ${WD_FULL[w.weekday - 1].toLowerCase()}`;
  const root = h('div', { class: 'stack' },
    backLink(lesson ? '#/lesson/' + ref.slice(2) : catalog ? '#/library' : '#/plan', lesson ? 'К уроку' : catalog ? 'Все тренировки' : 'План'),
    h('header', { class: 'page-head' },
      h('p', { class: 'row small muted', style: { gap: '6px' } }, icon(lesson || catalog ? 'clock' : slot.icon, 16), when, w.custom ? h('span', { class: 'tag', text: 'своя' }) : null, isHome ? h('span', { class: 'tag now', text: 'план Б, дома' }) : null),
      h('h1', { text: w.title }),
      h('p', { class: 'muted', text: `${w.focus}. Примерно ${w.minutes} мин.` }),
      whereTag(w)),
    h('a', { class: 'btn primary big block', href: '#/run/' + w.ref }, icon('play', 22), 'Начать тренировку'));

  // план Б: дождь, холод, нет места или стены, поэтому та же тренировка, но дома
  if (w.home) {
    root.append(h('section', { class: 'panel stack tight' },
      h('h3', { text: 'План Б: не получается на улице?' }),
      h('p', { class: 'small muted', text: 'Дождь, темно или нет места. Соберу такую же по цели тренировку для комнаты: без стены и поля, тихо, всё равно на точность, ловкость и скорость. Выполнится она так же, как обычная.' }),
      h('a', { class: 'btn block', href: '#/workout/' + w.home }, icon('home', 20), 'Сделать дома')));
  }
  if (isHome) {
    root.append(h('section', { class: 'panel stack tight' },
      h('p', { class: 'small muted', text: 'Это домашний вариант. Он засчитается как обычная тренировка в плане. Погода наладилась, вернись к обычной.' }),
      h('a', { class: 'btn sm', href: '#/workout/' + w.baseRef, text: 'Вернуться к обычной' })));
  }

  for (const [key, label] of PHASES) {
    const items = w.exercises.filter((e) => e.phase === key);
    if (!items.length) continue;
    root.append(h('section', { class: 'stack tight' },
      h('div', { class: 'row between' }, h('h2', { text: label }), h('span', { class: 'small muted', text: `${items.length} упр.` })),
      items.map((e, i) =>
        h('details', { class: 'ex-card' },
          h('summary', null,
            h('span', { class: 'n', text: i + 1 }),
            h('span', { class: 'nm' }, h('b', { text: e.name }), e.load ? h('span', { class: 'tag', text: e.load }) : null),
            h('span', { class: 'amt', text: amountText(e) }),
            h('span', { class: 'chev' }, icon('next', 18))),
          h('div', { class: 'ex-body stack tight' },
            h('p', { class: 'tip', text: e.tip }),
            exerciseTags(e),
            exerciseDetail(e))))));
  }

  if (w.custom) {
    root.append(h('button', {
      class: 'btn danger', onclick: async () => {
        if (!confirm('Удалить эту тренировку? Отчёты по ней останутся.')) return;
        try { await del('/api/custom/' + w.ref.slice(1)); toast('Тренировка удалена'); ctx.go('plan'); } catch (e) { toast(e.message, 'error'); }
      },
    }, icon('trash', 18), 'Удалить тренировку'));
  }
  return root;
}
