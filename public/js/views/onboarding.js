// Первый запуск: уровень -> данные -> оборудование -> цель и позиция.
import { get, post } from '../api.js';
import { h, toast } from '../ui.js';
import { levelChoice, bodyFields, equipmentFields, goalChoice, positionChoice, readProfile } from '../forms.js';

export async function render(ctx) {
  const catalog = await get('/api/catalog');
  const draft = { level: 'novice', goal: 'maintain', position: 'mid', equipment: ['ball', 'wall'], dumbbell_kg: null };
  const root = h('div', { class: 'stack' });
  const err = h('p', { class: 'err', role: 'alert' });

  const steps = [
    {
      title: 'Выбери свой уровень',
      sub: 'Он задаёт, сколько дней в неделю тренироваться и как тяжело. Потом можно поменять.',
      body: () => levelChoice(draft.level),
    },
    {
      title: 'Расскажи про себя',
      sub: 'По этим цифрам посчитаем калории и норму воды.',
      body: () => bodyFields(draft),
    },
    {
      title: 'Что у тебя есть',
      sub: 'Отметь, что у тебя есть. План соберётся под это. Нет стены или двора: точность и ловкость с мячом будем качать дома. Нет турника: будет тяга с гантелями или резинкой. Ничего нет, и так будет полноценная программа.',
      body: () => equipmentFields(catalog.equipment, draft),
    },
    {
      title: 'Цель и позиция',
      sub: 'Цель влияет на питание, позиция на советы.',
      body: () => h('div', { class: 'stack' },
        h('div', { class: 'stack tight' }, h('h3', { text: 'Цель' }), goalChoice(draft.goal)),
        h('div', { class: 'stack tight' }, h('h3', { text: 'Позиция на поле' }), positionChoice(draft.position))),
    },
  ];
  let step = 0;

  function show() {
    const s = steps[step];
    const body = s.body();
    const last = step === steps.length - 1;
    err.textContent = '';
    const form = h('form', { class: 'stack', novalidate: true, onsubmit: (e) => { e.preventDefault(); next(body, e.currentTarget); } },
      step === 0 ? h('div', { class: 'stack tight' },
        h('h1', { text: 'QuorFootball' }),
        h('p', { class: 'muted', text: 'Утром сила и скорость, вечером мяч. План под твоё оборудование, питание, вода, таймер, уроки и отчёты с фото.' })) : null,
      h('div', { class: 'onb-steps', 'aria-hidden': 'true' }, steps.map((_, i) => h('i', { class: i <= step ? 'on' : '' }))),
      h('header', { class: 'page-head' },
        h('p', { class: 'muted small', text: `Шаг ${step + 1} из ${steps.length}` }),
        h('h2', { text: s.title }),
        h('p', { class: 'muted', text: s.sub })),
      body,
      last ? h('p', { class: 'hint', text: 'Это расчёт на глаз, не врачебная рекомендация. Есть травмы или болезни, сначала к врачу. ' + (globalThis.QF_LOCAL ? 'Данные хранятся только на этом телефоне, удалить их можно в разделе «Ещё».' : 'Данные хранятся на сервере, где запущено приложение, удалить их можно в разделе «Ещё».') }) : null,
      err,
      h('div', { class: 'row wrap' },
        step > 0 ? h('button', { type: 'button', class: 'btn', text: 'Назад', onclick: () => { read(body); step--; show(); } }) : null,
        h('button', { type: 'submit', class: 'btn primary big grow', text: last ? 'Создать мой план' : 'Дальше' })));
    root.replaceChildren(form);
    form.querySelector('input:not([type=radio]):not([type=checkbox])')?.focus();
  }

  // забираем из формы только то, что есть на этом шаге
  function read(body) {
    const p = readProfile(body);
    for (const [k, v] of Object.entries(p)) {
      if (v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v))) continue;
      draft[k] = v;
    }
  }

  async function next(body, form) {
    read(body);
    if (step === 1) {
      if (!draft.name) return void (err.textContent = 'Напиши имя или ник.');
      if (!draft.sex) return void (err.textContent = 'Выбери пол.');
      if (!(draft.age >= 10 && draft.age <= 60)) return void (err.textContent = 'Возраст должен быть от 10 до 60 лет.');
      if (!(draft.height >= 100 && draft.height <= 230)) return void (err.textContent = 'Рост должен быть от 100 до 230 см.');
      if (!(draft.weight >= 25 && draft.weight <= 200)) return void (err.textContent = 'Вес должен быть от 25 до 200 кг.');
    }
    if (step < steps.length - 1) { step++; return show(); }
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await post('/api/profile', draft);
      await ctx.loadUser();
      toast('Профиль создан. Вот твой план.');
      ctx.go('');
    } catch (e) {
      err.textContent = e.message;
      btn.disabled = false;
    }
  }

  show();
  return root;
}
