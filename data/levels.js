// Уровни: сколько подходов, во сколько раз меняем повторы и сколько отдыхать.
const LEVELS = {
  novice: { label: 'Новичок', sets: 2, mult: 0.8, rest: 45 },
  middle: { label: 'Средний', sets: 3, mult: 1, rest: 40 },
  pro: { label: 'Опытный', sets: 4, mult: 1.2, rest: 30 },
};

module.exports = { LEVELS };
