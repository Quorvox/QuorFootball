// Поля профиля: одни и те же в первом запуске и в настройках.
import { h } from './ui.js';
import { choiceGroup, field, checked } from './components.js';

export const LEVEL_OPTIONS = [
  { value: 'novice', title: 'Новичок', text: '4 дня в неделю: 3 тренировки и день восстановления. По 2 подхода, отдыха побольше.' },
  { value: 'middle', title: 'Средний', text: '5 дней: 4 тренировки и восстановление. По 3 подхода. Подходит, если уже тренируешься.' },
  { value: 'pro', title: 'Опытный', text: '6 дней: 5 тренировок и восстановление. По 4 подхода, отдых короткий.' },
];
export const GOAL_OPTIONS = [
  { value: 'maintain', title: 'Держать вес', text: 'Калории на уровне расхода.' },
  { value: 'gain', title: 'Набрать массу', text: 'Небольшой избыток калорий.' },
  { value: 'lose', title: 'Сбросить вес', text: 'Небольшой дефицит. До 18 лет не ставим.' },
];
export const POSITION_OPTIONS = [
  { value: 'gk', title: 'Вратарь' },
  { value: 'def', title: 'Защитник' },
  { value: 'mid', title: 'Полузащитник' },
  { value: 'fwd', title: 'Нападающий' },
];
const DUMBBELL_KG = [2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32];

export const levelChoice = (v) => choiceGroup('level', LEVEL_OPTIONS, v);
export const goalChoice = (v) => choiceGroup('goal', GOAL_OPTIONS, v);
export const positionChoice = (v) => choiceGroup('position', POSITION_OPTIONS, v, { two: true });

export function bodyFields(p = {}) {
  return h('div', { class: 'stack tight' },
    field('f-name', 'Имя или ник', h('input', { type: 'text', id: 'f-name', name: 'name', maxlength: 40, autocomplete: 'nickname', value: p.name || '', required: true })),
    h('div', { class: 'field' }, h('span', { class: 'label', text: 'Пол' }),
      choiceGroup('sex', [{ value: 'm', title: 'Парень' }, { value: 'f', title: 'Девушка' }], p.sex, { two: true }),
      h('span', { class: 'hint', text: 'Нужен только для расчёта калорий.' })),
    h('div', { class: 'grid3' },
      field('f-age', 'Возраст', h('input', { type: 'number', id: 'f-age', name: 'age', min: 10, max: 60, inputmode: 'numeric', value: p.age ?? '', required: true })),
      field('f-height', 'Рост, см', h('input', { type: 'number', id: 'f-height', name: 'height', min: 100, max: 230, inputmode: 'numeric', value: p.height ?? '', required: true })),
      field('f-weight', 'Вес, кг', h('input', { type: 'number', id: 'f-weight', name: 'weight', min: 25, max: 200, step: '0.1', inputmode: 'decimal', value: p.weight ?? '', required: true }))));
}

// что есть из оборудования; вес гантели показываем, только если они отмечены
export function equipmentFields(catalog, p = {}) {
  const sel = new Set(p.equipment ?? ['ball', 'wall']);
  const kg = p.dumbbell_kg || 8;
  const kgSelect = h('select', { id: 'f-kg', name: 'dumbbell_kg' },
    DUMBBELL_KG.map((n) => h('option', { value: n, text: `${n} кг`, selected: n === kg })));
  const kgField = h('div', { class: 'field', hidden: !sel.has('dumbbells') },
    h('label', { for: 'f-kg', text: 'Вес одной гантели' }), kgSelect,
    h('span', { class: 'hint', text: 'Подбери вес, с которым жим даётся 10-12 раз с трудом. Разборные: поставь рабочий вес.' }));
  const root = h('div', { class: 'stack tight', dataset: { equip: '1' } },
    catalog.map((e) => h('label', { class: 'check panel', style: { padding: '12px 14px' } },
      h('input', {
        type: 'checkbox', name: 'equipment', value: e.id, checked: sel.has(e.id),
        onchange: (ev) => { if (e.id === 'dumbbells') kgField.hidden = !ev.target.checked; },
      }),
      h('span', { class: 'grow' }, h('b', { text: e.label }), e.hint ? h('span', { class: 'small muted', style: { display: 'block' }, text: e.hint }) : null))),
    kgField);
  return root;
}

// читаем всё, что есть в форме, в один объект; чего нет на этом шаге, остаётся undefined
export function readProfile(root) {
  const val = (n) => root.querySelector(`[name="${n}"]`)?.value;
  const eq = root.matches?.('[data-equip]') ? root : root.querySelector('[data-equip]');
  return {
    name: val('name')?.trim(),
    sex: checked(root, 'sex'),
    age: Number(val('age')),
    height: Number(val('height')),
    weight: val('weight') === undefined ? undefined : Number(String(val('weight')).replace(',', '.')),
    level: checked(root, 'level'),
    goal: checked(root, 'goal'),
    position: checked(root, 'position'),
    equipment: eq ? [...eq.querySelectorAll('input[name=equipment]:checked')].map((i) => i.value) : undefined,
    dumbbell_kg: eq ? Number(eq.querySelector('[name=dumbbell_kg]')?.value) || null : undefined,
  };
}
