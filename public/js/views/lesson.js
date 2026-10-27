// Урок: ступени с отметками, схемы, ошибки, упражнения и видео.
import { get, post } from '../api.js';
import { h, icon, localDate, store, toast, fmtShort } from '../ui.js';
import { backLink, figure, videoBlock, youtubeSearch } from '../components.js';
import { lineChart } from '../chart.js';

export async function render(ctx) {
  const l = await get('/api/lessons/' + encodeURIComponent(ctx.params[0]));
  const key = 'lesson-' + l.id;
  const have = new Set(ctx.user.equipment);
  let done = new Set(store.get(key, []));

  const bar = h('div', { class: 'bar-fill accent' });
  const barText = h('span', { class: 'small muted' });
  const drawBar = () => {
    bar.style.width = (done.size * 100) / l.steps.length + '%';
    barText.textContent = `Пройдено ступеней: ${done.size} из ${l.steps.length}`;
  };

  const steps = h('ol', { class: 'ladder' }, l.steps.map((s, i) =>
    h('li', null,
      h('label', { class: 'check' },
        h('input', {
          type: 'checkbox', checked: done.has(i), 'aria-label': `Ступень пройдена: ${s.h}`,
          onchange: (e) => { e.target.checked ? done.add(i) : done.delete(i); store.set(key, [...done]); drawBar(); },
        }),
        h('div', { class: 'grow stack tight' },
          h('b', { class: 'step-h', text: s.h }),
          h('p', { text: s.text }),
          s.goal ? h('p', { class: 'goal small', text: `Цель: ${s.goal}` }) : null)))));

  const root = h('div', { class: 'stack' },
    backLink('#/school', 'Школа'),
    h('header', { class: 'page-head' },
      h('p', { class: 'small muted', text: `${l.level}, ${l.minutes} мин` }),
      h('h1', { text: l.title }),
      h('p', { class: 'muted', text: l.summary })),
    h('p', { text: l.intro }),
    h('a', { class: 'btn primary big block', href: '#/workout/l-' + l.id }, icon('play', 22), 'Потренировать сейчас'),
    l.photo ? h('img', { class: 'preview', src: l.photo, alt: l.title, loading: 'lazy' }) : null,
    ...(l.figs || []).map((f) => figure(f)),
    h('section', { class: 'stack tight' },
      h('h2', { text: 'Шаг за шагом' }),
      h('div', { class: 'bar-track', 'aria-hidden': 'true' }, bar), barText, steps));
  drawBar();

  if (l.record === 'juggle') root.append(await recordBlock());

  if (l.mistakes?.length) root.append(h('section', { class: 'panel stack tight' }, h('h3', { text: 'Частые ошибки' }), h('ul', { class: 'mistakes' }, l.mistakes.map((m) => h('li', { text: m })))));
  if (l.tips?.length) root.append(h('section', { class: 'panel stack tight' }, h('h3', { text: 'Советы' }), h('ul', { class: 'mistakes' }, l.tips.map((m) => h('li', { text: m })))));

  root.append(h('section', { class: 'stack tight' },
    h('h2', { text: 'Упражнения к уроку' }),
    h('ul', { class: 'list panel' }, l.drills.map((d) => {
      const lack = d.needs.filter((n) => !have.has(n));
      return h('li', null,
        h('div', { class: 'name', style: { fontWeight: '600' }, text: d.name }),
        h('p', { class: 'small muted', text: d.tip }),
        lack.length ? h('p', { class: 'small', text: 'Нужно оборудование: добавь в профиле' }) : null);
    }))));

  root.append(h('section', { class: 'stack tight' },
    h('h2', { text: 'Видео' }),
    ...(l.videos || []).map(videoBlock),
    h('a', { class: 'btn', href: youtubeSearch(l.search), target: '_blank', rel: 'noopener noreferrer' }, icon('video', 20), 'Найти видео по теме'),
    h('p', { class: 'hint', text: 'Видео чужие, открываются с YouTube только после нажатия. Смотри на технику, а не на трюки.' })));

  // рекорд чеканки: пишем число, видим график
  async function recordBlock() {
    const rec = await get('/api/records?kind=juggle');
    const input = h('input', { type: 'number', id: 'rec-v', min: 1, max: 100000, inputmode: 'numeric', placeholder: 'Сколько касаний подряд' });
    const box = h('section', { class: 'panel stack' });
    const draw = (r) => box.replaceChildren(
      h('h3', { text: 'Твой рекорд чеканки' }),
      h('div', { class: 'num', style: { fontSize: '44px', lineHeight: '1' } }, String(r.best), h('span', { class: 'small muted', text: ' касаний' })),
      lineChart(r.items.map((x) => ({ date: x.date, value: x.value })), { unit: 'касаний', empty: 'Запиши результат хотя бы два дня, и тут появится график.' }),
      h('form', {
        class: 'row', style: { alignItems: 'flex-end' }, onsubmit: async (e) => {
          e.preventDefault();
          try {
            await post('/api/records', { date: localDate(), kind: 'juggle', value: Number(input.value) });
            toast('Записано');
            draw(await get('/api/records?kind=juggle'));
          } catch (ex) { toast(ex.message, 'error'); }
        },
      },
        h('div', { class: 'field grow' }, h('label', { for: 'rec-v', text: `Лучший за сегодня, ${fmtShort(localDate())}` }), input),
        h('button', { class: 'btn primary', type: 'submit', text: 'Записать' })));
    draw(rec);
    return box;
  }

  return root;
}
