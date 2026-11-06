// Первый запуск: уровень -> что тренируем -> стиль бокса -> данные -> оборудование -> цель (и позиция для футбола).
import { get, post } from '../api.js';
import { h, toast } from '../ui.js';
import { levelChoice, sportChoice, boxStyleChoice, bodyFields, equipmentFields, goalChoice, positionChoice, readProfile } from '../forms.js';

export async function render(ctx) {
  const catalog = await get('/api/catalog');
  const draft = { level: 'novice', goal: 'maintain', position: 'mid', sport: 'football', box_style: 'soviet', equipment: ['ball', 'wall'], dumbbell_kg: null };
  let eqUntouched = true; // пока оборудование не открывали, подставляем набор под выбранный спорт
  const root = h('div', { class: 'stack' });
  const err = h('p', { class: 'err', role: 'alert' });

  // шаги зависят от выбора: стиль бокса только для боксёра, позиция только для футболиста
  const buildSteps = () => [
    {
      id: 'level',
      title: 'Выбери свой уровень',
      sub: 'Он задаёт, сколько дней в неделю тренироваться и как тяжело. Потом можно поменять.',
      body: () => levelChoice(draft.level),
    },
    {
      id: 'sport',
      title: 'Что будешь тренировать',
      sub: 'Выбери футбол, бокс или оба сразу: вечерние тренировки будут чередоваться. Утром в любом случае сила и скорость. Потом можно поменять в профиле.',
      body: () => sportChoice(draft.sport),
    },
    ...(draft.sport === 'football' ? [] : [{
      id: 'style',
      title: 'Стиль бокса',
      sub: 'Стиль меняет упражнения и подсказки тренера. Базу (стойка, джеб, кросс, защита) учат все. Выбери, что ближе, и меняй в профиле, когда захочешь.',
      body: () => boxStyleChoice(draft.box_style),
    }]),
    {
      id: 'body',
      title: 'Расскажи про себя',
      sub: 'По этим цифрам посчитаем калории и норму воды.',
      body: () => bodyFields(draft),
    },
    {
      id: 'equipment',
      title: 'Что у тебя есть',
      sub: 'Отметь, что у тебя есть. План соберётся под это. Нет стены или двора: точность и ловкость с мячом будем качать дома. Нет мешка: бой с тенью. Нет турника: будет тяга с гантелями или резинкой. Ничего нет, и так будет полноценная программа.',
      body: () => equipmentFields(catalog.equipment, draft),
    },
    {
      id: 'goal',
      title: draft.sport === 'boxing' ? 'Цель' : 'Цель и позиция',
      sub: draft.sport === 'boxing' ? 'Цель влияет на питание.' : 'Цель влияет на питание, позиция на советы.',
      body: () => h('div', { class: 'stack' },
        h('div', { class: 'stack tight' }, h('h3', { text: 'Цель' }), goalChoice(draft.goal)),
        draft.sport === 'boxing' ? null : h('div', { class: 'stack tight' }, h('h3', { text: 'Позиция на поле' }), positionChoice(draft.position))),
    },
  ];
  let step = 0;

  function show() {
    const steps = buildSteps();
    const s = steps[step];
    const body = s.body();
    const last = step === steps.length - 1;
    err.textContent = '';
    const form = h('form', { class: 'stack', novalidate: true, onsubmit: (e) => { e.preventDefault(); next(body, e.currentTarget); } },
      step === 0 ? h('div', { class: 'stack tight' },
        h('h1', { text: 'QuorFootball' }),
        h('p', { class: 'muted', text: 'Футбол и бокс. Утром сила и скорость, вечером мяч или бокс. План под твоё оборудование, питание, вода, таймер, уроки и отчёты с фото.' })) : null,
      h('div', { class: 'onb-steps', 'aria-hidden': 'true' }, steps.map((_, i) => h('i', { class: i <= step ? 'on' : '' }))),
      h('header', { class: 'page-head' },
        h('p', { class: 'muted small', text: `Шаг ${step + 1} из ${steps.length}` }),
        h('h2', { text: s.title }),
        h('p', { class: 'muted', text: s.sub })),
      body,
      last ? h('p', { class: 'hint', text: (draft.sport !== 'football' ? 'Бокс здесь без спарринга: спарринг только с тренером, в шлеме и перчатках. ' : '') + 'Это расчёт на глаз, не врачебная рекомендация. Есть травмы или болезни, сначала к врачу. ' + (globalThis.QF_LOCAL ? 'Данные хранятся только на этом телефоне, удалить их можно в разделе «Ещё».' : 'Данные хранятся на сервере, где запущено приложение, удалить их можно в разделе «Ещё».') }) : null,
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
    const steps = buildSteps();
    const id = steps[step].id;
    // выбрали спорт: подставляем типичный набор оборудования, если на шаге «Что у тебя есть» ещё не были
    if (id === 'sport' && eqUntouched) {
      draft.equipment = draft.sport === 'boxing' ? ['rope'] : draft.sport === 'both' ? ['ball', 'wall', 'rope'] : ['ball', 'wall'];
    }
    if (id === 'equipment') eqUntouched = false;
    if (id === 'body') {
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
