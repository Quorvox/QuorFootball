// Своя тренировка: выбираешь упражнения из базы, ставишь день и время.
import { get, post } from '../api.js';
import { h, icon, toast, WD_FULL } from '../ui.js';
import { pageHead, backLink } from '../components.js';

export async function render(ctx) {
  const lib = await get('/api/exercises');
  const chosen = []; // {key, name, kind, sets, amount}
  const list = h('ul', { class: 'list' });
  const empty = h('p', { class: 'muted', text: 'Пока пусто. Добавь упражнения из списка ниже.' });
  const err = h('p', { class: 'err', role: 'alert' });

  function drawChosen() {
    empty.hidden = chosen.length > 0;
    list.replaceChildren(...chosen.map((c, idx) => {
      const unit = c.kind === 'time' ? 'сек' : 'повт.';
      const num = (v, min, max, on) => h('input', { type: 'number', min, max, inputmode: 'numeric', value: v, style: { width: '84px', minHeight: '44px' }, onchange: (e) => on(Math.min(max, Math.max(min, Math.round(Number(e.target.value)) || min))) });
      return h('li', { class: 'stack tight' },
        h('div', { class: 'row between' },
          h('span', { class: 'name', style: { fontWeight: '600' }, text: c.name }),
          h('button', { type: 'button', class: 'btn quiet sm', 'aria-label': `Убрать ${c.name}`, onclick: () => { chosen.splice(idx, 1); drawChosen(); } }, icon('x', 18))),
        h('div', { class: 'row wrap' },
          h('label', { class: 'row small' }, 'Подходов', num(c.sets, 1, 6, (v) => { c.sets = v; })),
          h('label', { class: 'row small' }, unit === 'сек' ? 'Секунд' : 'Повторов', num(c.amount, 5, 300, (v) => { c.amount = v; }))));
    }));
  }

  const library = h('div', { class: 'stack tight' }, lib.groups.map((g) =>
    h('details', { class: 'panel' },
      h('summary', { style: { fontWeight: '600', fontSize: '17px', color: 'inherit', margin: 0 }, text: g.label }),
      h('ul', { class: 'list' }, g.items.map((it) =>
        h('li', { class: 'row between' },
          h('div', { class: 'grow' }, h('div', { style: { fontWeight: '600' }, text: it.name + (it.load ? `, ${it.load}` : '') }), h('div', { class: 'small muted', text: it.tip })),
          h('button', {
            type: 'button', class: 'btn sm', 'aria-label': `Добавить ${it.name}`, onclick: () => {
              if (chosen.length >= 20) return toast('Не больше 20 упражнений', 'error');
              chosen.push({ key: it.key, name: it.name, kind: it.kind, sets: it.sets, amount: it.amount });
              drawChosen();
            },
          }, icon('plus', 18))))))));

  const title = h('input', { type: 'text', id: 'b-title', maxlength: 60, placeholder: 'Например, Мяч у стены' });
  const day = h('select', { id: 'b-day' }, WD_FULL.map((n, i) => h('option', { value: i + 1, text: n })));
  day.value = String(((new Date().getDay() + 6) % 7) + 1);
  const slot = h('select', { id: 'b-slot' }, h('option', { value: 'morning', text: 'Утро' }), h('option', { value: 'evening', text: 'Вечер' }));
  const warm = h('input', { type: 'checkbox', id: 'b-warm', checked: true });
  const save = h('button', { class: 'btn primary big block', type: 'submit', text: 'Сохранить тренировку' });

  const form = h('form', {
    class: 'stack', onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!title.value.trim()) return void (err.textContent = 'Дай тренировке название.');
      if (!chosen.length) return void (err.textContent = 'Добавь хотя бы одно упражнение.');
      save.disabled = true;
      try {
        const r = await post('/api/custom', { title: title.value, weekday: Number(day.value), slot: slot.value, withWarmup: warm.checked, items: chosen.map(({ key, sets, amount }) => ({ key, sets, amount })) });
        toast('Тренировка сохранена');
        ctx.go('workout/' + r.ref);
      } catch (ex) { err.textContent = ex.message; save.disabled = false; }
    },
  },
    h('div', { class: 'field' }, h('label', { for: 'b-title', text: 'Название' }), title),
    h('div', { class: 'grid2' },
      h('div', { class: 'field' }, h('label', { for: 'b-day', text: 'День' }), day),
      h('div', { class: 'field' }, h('label', { for: 'b-slot', text: 'Время' }), slot)),
    h('label', { class: 'check' }, warm, h('span', { text: 'Добавить разминку и растяжку' })),
    h('section', { class: 'panel stack tight' }, h('h3', { text: 'Твои упражнения' }), empty, list),
    err, save);

  return h('div', { class: 'stack' },
    backLink('#/more', 'Ещё'),
    pageHead('Своя тренировка', 'Она встанет в план на выбранный день каждую неделю.'),
    form,
    h('section', { class: 'stack tight' }, h('h2', { text: 'База упражнений' }), library,
      lib.hidden ? h('p', { class: 'hint' }, `Ещё ${lib.hidden} упражнений скрыто: для них нужно оборудование. Добавь его в `, h('a', { href: '#/profile', text: 'профиле' }), '.') : null));
}
