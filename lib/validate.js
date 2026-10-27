// Проверка того, что пришло от клиента.
const { LEVELS } = require('../data/levels');
const { EQUIPMENT } = require('../data/library');

const SEX = ['m', 'f'];
const GOALS = ['maintain', 'gain', 'lose'];
const POSITIONS = ['gk', 'def', 'mid', 'fwd'];
const EQUIP_IDS = EQUIPMENT.map((e) => e.id);

const inRange = (n, a, b) => Number.isFinite(n) && n >= a && n <= b;

function cleanProfile(b = {}) {
  const name = String(b.name ?? '').trim().slice(0, 40);
  const age = Number(b.age);
  const height = Number(b.height);
  const weight = Number(b.weight);
  if (!name) return { error: 'Напиши имя или ник.' };
  if (!SEX.includes(b.sex)) return { error: 'Выбери пол.' };
  if (!Number.isInteger(age) || !inRange(age, 10, 60)) return { error: 'Возраст должен быть от 10 до 60 лет.' };
  if (!inRange(height, 100, 230)) return { error: 'Рост должен быть от 100 до 230 см.' };
  if (!inRange(weight, 25, 200)) return { error: 'Вес должен быть от 25 до 200 кг.' };
  if (!LEVELS[b.level]) return { error: 'Выбери уровень.' };
  if (!GOALS.includes(b.goal)) return { error: 'Выбери цель.' };
  if (!POSITIONS.includes(b.position)) return { error: 'Выбери позицию.' };

  const raw = Array.isArray(b.equipment) ? b.equipment : [];
  const equipment = EQUIP_IDS.filter((id) => raw.includes(id));
  let dumbbell = null;
  if (equipment.includes('dumbbells')) {
    dumbbell = Number(b.dumbbell_kg);
    if (!inRange(dumbbell, 1, 60)) return { error: 'Укажи вес одной гантели, от 1 до 60 кг.' };
    dumbbell = Math.round(dumbbell * 2) / 2;
  }
  return {
    value: {
      name, sex: b.sex, age, height: Math.round(height), weight: Math.round(weight * 10) / 10,
      level: b.level, goal: b.goal, position: b.position, equipment, dumbbell_kg: dumbbell,
    },
  };
}

module.exports = { cleanProfile };
