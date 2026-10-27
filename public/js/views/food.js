// Питание, советы и список покупок. Это оценка, не врачебная рекомендация.
import { get } from '../api.js';
import { h, icon, store } from '../ui.js';
import { pageHead } from '../components.js';

const TABS = [['diet', 'Рацион'], ['tips', 'Советы'], ['shop', 'Покупки']];
const GOALS = { maintain: 'держим вес', gain: 'набираем массу', lose: 'сбрасываем вес' };

export async function render(ctx) {
  const n = await get('/api/nutrition');
  let tab = store.get('food-tab', 'diet');
  const body = h('div', { class: 'stack' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Раздел' });

  function draw() {
    seg.replaceChildren(...TABS.map(([k, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(k === tab), text: label, onclick: () => { tab = k; store.set('food-tab', k); draw(); } })));
    body.replaceChildren(tab === 'diet' ? diet() : tab === 'tips' ? tips() : shop());
  }

  function macro(label, grams, kcalPer, total) {
    const pct = Math.round((grams * kcalPer * 100) / total);
    return h('div', { class: 'stack tight' },
      h('div', { class: 'row between' }, h('span', { style: { fontWeight: '600' }, text: label }), h('span', { class: 'num', text: `${grams} г` })),
      h('div', { class: 'bar-track', role: 'img', 'aria-label': `${label}: ${pct}% калорий` }, h('div', { class: 'bar-fill accent', style: { width: Math.min(100, pct) + '%' } })),
      h('span', { class: 'small muted', text: `${pct}% калорий` }));
  }

  function diet() {
    const c = n.calc;
    return h('div', { class: 'stack' },
      h('section', { class: 'panel stack' },
        h('div', null, h('div', { class: 'big-kcal', text: c.kcal }), h('p', { class: 'muted', text: `ккал в день, ${GOALS[c.goalApplied]}` })),
        c.goalNote ? h('p', { class: 'err', text: c.goalNote }) : null,
        macro('Белки', c.protein, 4, c.kcal), macro('Жиры', c.fat, 9, c.kcal), macro('Углеводы', c.carbs, 4, c.kcal),
        h('p', { class: 'hint', text: `Основной обмен ${c.bmr} ккал. Тренировочных дней в неделю: ${c.trainingDays}.` })),
      h('section', { class: 'panel stack tight' },
        h('h3', { class: 'row', style: { gap: '8px' } }, icon('drop', 22), 'Вода'),
        h('div', { class: 'grid2' },
          h('div', null, h('div', { class: 'num', style: { fontSize: '34px' }, text: c.waterTrain }), h('div', { class: 'small muted', text: 'мл в день с тренировкой' })),
          h('div', null, h('div', { class: 'num', style: { fontSize: '34px' }, text: c.waterRest }), h('div', { class: 'small muted', text: 'мл в день без неё' }))),
        h('p', { class: 'hint', text: 'Пей небольшими порциями в течение дня. Моча светло-жёлтая — значит воды хватает.' })),
      h('section', { class: 'panel stack tight' },
        h('h3', { text: 'Еда по приёмам' }),
        h('ul', { class: 'list' }, n.meals.map((m) =>
          h('li', null,
            h('div', { class: 'ex' }, h('span', { class: 'name', text: m.name }), h('span', { class: 'amt', text: `${m.kcal} ккал` })),
            h('p', { class: 'small muted', text: m.example }))))),
      h('p', { class: 'hint', text: 'Расчёт примерный, по формуле Миффлина-Сан Жеора. Если есть болезни, аллергии или ты хочешь резко менять вес, сначала поговори с врачом или тренером.' }));
  }

  function tips() {
    return h('section', { class: 'panel' }, h('ul', { class: 'list' }, n.tips.map((t) => h('li', { text: t }))));
  }

  // отметки «купил» хранятся только в браузере
  function shop() {
    const bought = new Set(store.get('shop-done', []));
    const row = (name, note) => {
      const id = 's-' + name;
      const cb = h('input', { type: 'checkbox', id, checked: bought.has(name), onchange: (e) => {
        e.target.checked ? bought.add(name) : bought.delete(name);
        store.set('shop-done', [...bought]);
        e.target.closest('.check').classList.toggle('done', e.target.checked);
      } });
      return h('li', null, h('label', { class: 'check' + (bought.has(name) ? ' done' : ''), for: id }, cb, h('span', { class: 'grow' }, name), h('span', { class: 'muted small', text: note })));
    };
    return h('div', { class: 'stack' },
      h('section', { class: 'panel stack tight' },
        h('h3', { class: 'row', style: { gap: '8px' } }, icon('cart', 22), 'Продукты на неделю'),
        h('p', { class: 'small muted', text: 'Примерно на одного человека под твою калорийность. Цен не пишем: они зависят от магазина.' }),
        h('ul', { class: 'list' }, n.shopping.products.map(([a, b]) => row(a, b)))),
      h('section', { class: 'panel stack tight' },
        h('h3', { class: 'row', style: { gap: '8px' } }, icon('dumbbell', 22), 'Инвентарь'),
        h('ul', { class: 'list' }, n.shopping.equipment.map(([a, b]) => row(a, b)))));
  }

  draw();
  return h('div', { class: 'stack' }, pageHead('Питание', `Для ${ctx.user.name}: ${ctx.user.weight} кг, ${ctx.user.height} см.`), seg, body);
}
