// Сборка тренировок под человека: уровень + оборудование + вес гантелей.
const { LEVELS } = require('../data/levels');
const { LIB } = require('../data/library');
const { COMBOS } = require('../data/boxing');
const { SESSIONS, SCHEDULE, WARM, WARM_BALL, WARM_BOX, COOL, NO_BALL, BOX_FALLBACK } = require('../data/program');

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function haveOf(user) {
  let list = [];
  try { list = JSON.parse(user.equipment || '[]'); } catch { /* пусто */ }
  return new Set(list);
}

// в тихом режиме шумные упражнения (прыжки, спринты) не берём; в тесном (1×1 м) только то, что делается на месте
const ok = (key, have) => {
  const e = LIB[key];
  if (!e || !e.needs.every((n) => have.has(n))) return false;
  if (have.has('quiet') && e.loud) return false;
  if (have.has('tight') && (e.space === 'small' || e.space === 'big')) return false;
  return true;
};

// прогрессия по 4-недельному циклу: три недели нагрузка растёт, четвёртая разгрузочная; с каждым циклом база выше
function progress(user) {
  const days = Math.floor((Date.now() - Date.parse(String(user.created_at || '').replace(' ', 'T') + 'Z')) / 86400000);
  if (!(days > 0)) return 1;
  const week = Math.floor(days / 7);
  const inCycle = week % 4;
  if (inCycle === 3) return 0.75;
  return 1 + 0.05 * inCycle + 0.1 * Math.min(Math.floor(week / 4), 3);
}

// style: стиль бокса человека, от него зависят голосовые комбинации на бое с тенью
function item(key, level, phase, sets, dbKg, prog = 1, style = 'soviet') {
  const e = LIB[key];
  const L = LEVELS[level];
  let mult = phase === 'main' ? L.mult * prog : 1;
  const heavy = e.needs.includes('dumbbells') && dbKg;
  if (phase === 'main' && heavy) mult *= dbKg <= 6 ? 1.25 : dbKg >= 16 ? 0.8 : 1;
  const amount = e.kind === 'time'
    ? (phase === 'main' ? round5(e.base * mult) : e.base)
    : (phase === 'main' ? Math.max(5, Math.round(e.base * mult)) : e.base);
  return {
    key, name: e.name, kind: e.kind, amount, sets,
    rest: phase === 'main' ? L.rest : 10,
    phase, tip: e.tip, steps: e.steps, mistakes: e.mistakes, fig: e.fig,
    why: e.why, school: e.school, space: e.space, pressure: e.pressure, cat: e.cat, lvl: e.lvl, styles: e.styles, video: e.video, group: e.group,
    load: heavy ? `по ${dbKg} кг` : null,
    // тренер говорит серии голосом: список по стилю и уровню, пауза между подсказками короче у опытных
    calls: e.calls && phase === 'main' ? (COMBOS[style] || COMBOS.soviet)[level] : null,
    callGap: level === 'novice' ? 7 : level === 'middle' ? 5 : 4,
  };
}

// слоты тренировки: у бокса свой набор для каждого стиля, у остальных общий по уровню
const slotsOf = (code, level, style) => {
  const s = SESSIONS[code];
  return s.byStyle ? (s.byStyle[style] || s.byStyle.soviet)[level] : s.slots[level];
};

function pickMain(code, level, have, variant, style) {
  const used = new Set();
  const out = [];
  for (const cand of slotsOf(code, level, style)) {
    const opts = cand.filter((k) => ok(k, have) && !used.has(k));
    if (!opts.length) continue;
    const k = opts[Math.min(variant - 1, opts.length - 1)];
    used.add(k);
    out.push(k);
  }
  return out;
}

// kind: 'ball' или 'box' меняет разминку; style нужен бою с тенью
function wrap(level, mainKeys, sets, kind, dbKg, prog = 1, style = 'soviet') {
  const warm = kind === 'box' ? WARM_BOX : kind === 'ball' ? WARM_BALL : WARM;
  return [
    ...warm.map((k) => item(k, level, 'warmup', 1, dbKg, 1, style)),
    ...mainKeys.map((k) => item(k, level, 'main', sets, dbKg, prog, style)),
    ...COOL.map((k) => item(k, level, 'cooldown', 1, dbKg, 1, style)),
  ];
}

// home: план Б. Без стены и двора, тихо, всё из того, что есть в комнате
function buildSession(user, code, variant = 1, { home = false, silent = false } = {}) {
  const s = SESSIONS[code];
  const level = user.level;
  const have = haveOf(user);
  if (home) { have.delete('wall'); have.delete('yard'); have.add('quiet'); }
  const dbKg = have.has('dumbbells') ? user.dumbbell_kg : null;
  const isBall = code.startsWith('BALL');
  const isBox = code.startsWith('BOX');
  const style = user.box_style || 'soviet';
  let keys = pickMain(code, level, have, variant, style);
  let focus = s.focus;
  if (isBall && keys.length < 3) { keys = NO_BALL.filter((k) => ok(k, have)); focus = 'Мяча нет, поэтому работаем над ловкостью без него'; }
  // мешка нет или не хватает места: бой с тенью и защита без снаряда
  if (isBox && keys.length < 3) { keys = BOX_FALLBACK.filter((k) => ok(k, have)); focus = 'Мешка нет, поэтому бой с тенью и защита без снаряда'; }
  const sets = s.light ? 2 : LEVELS[level].sets;
  const title = variant > 1 && !silent ? `${s.title}, вариант ${variant}` : s.title;
  const exercises = wrap(level, keys, sets, isBall ? 'ball' : isBox ? 'box' : null, dbKg, progress(user), style);
  // план Б предлагаем, только если дома получится другая тренировка (чеканка и так делается в комнате)
  let outdoor = Boolean(s.outdoor);
  if (outdoor && !home) {
    const alt = buildSession(user, code, variant, { home: true, silent });
    outdoor = alt.exercises.map((e) => e.key).join() !== exercises.map((e) => e.key).join();
  }
  return { title, focus, outdoor, exercises };
}

// номер недели с регистрации: мячевые тренировки каждую неделю берут другие упражнения из слота, чтобы не наскучить
function weekIndex(user) {
  const days = Math.floor((Date.now() - Date.parse(String(user.created_at || '').replace(' ', 'T') + 'Z')) / 86400000);
  return days > 0 ? Math.floor(days / 7) : 0;
}

// что тренируем: футбол как есть; бокс заменяет мяч вечером и «скорость» утром; оба чередуют мяч и бокс по вечерам
const BOX_OF = { BALL1: 'BOX1', BALL2: 'BOX2', BALL3: 'BOX3' };
function sportCode(sport, code, ballIndex) {
  if (sport === 'boxing') return code === 'SPEED' ? 'BOX6' : (BOX_OF[code] || code);
  if (sport === 'both' && BOX_OF[code] && ballIndex % 2 === 1) return BOX_OF[code];
  return code;
}

// все тренировки недели для человека
function generated(user) {
  const out = [];
  const rot = weekIndex(user) % 3;
  const sport = user.sport || 'football';
  let ballIndex = 0;
  for (const [weekday, am, amV, pm, pmV] of SCHEDULE[user.level]) {
    for (const [base, v, slot, letter] of [[am, amV, 'morning', 'm'], [pm, pmV, 'evening', 'e']]) {
      if (!base) continue;
      const code = sportCode(sport, base, ballIndex);
      if (BOX_OF[base]) ballIndex++;
      const variant = code.startsWith('BALL') || code.startsWith('BOX') ? ((v - 1 + rot) % 3) + 1 : v;
      out.push({ ref: `g${weekday}${letter}`, weekday, slot, code, variant, ...buildSession(user, code, variant, { silent: true }) });
    }
  }
  return out;
}

// мини-тренировка по теме урока
function buildLessonWorkout(user, lesson) {
  const level = user.level;
  const have = haveOf(user);
  const dbKg = have.has('dumbbells') ? user.dumbbell_kg : null;
  const keys = lesson.practice.filter((k) => ok(k, have));
  if (!keys.length) return null;
  return {
    ref: `l-${lesson.id}`, title: `Урок: ${lesson.title}`, focus: lesson.summary,
    slot: 'evening', weekday: null,
    exercises: wrap(level, keys, LEVELS[level].sets, lesson.group === 'ball' ? 'ball' : lesson.group === 'box' ? 'box' : null, dbKg, progress(user), user.box_style || 'soviet'),
  };
}

module.exports = { haveOf, ok, item, generated, buildSession, buildLessonWorkout, SCHEDULE };
