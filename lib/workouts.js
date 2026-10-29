// Тренировки человека: собранные по плану + свои + мини-тренировки из уроков.
const { db } = require('../db');
const { estimateMin, weekDates, weekdayOf, addDays } = require('./util');
const { generated, buildLessonWorkout, buildSession } = require('./build');
const { SESSIONS, SESSION_GROUPS } = require('../data/program');
const { byId: lessonById } = require('../data/lessons');

const SLOT_ORDER = { morning: 0, evening: 1 };

function card(w) {
  return {
    ref: w.ref,
    title: w.title,
    focus: w.focus,
    slot: w.slot,
    weekday: w.weekday,
    custom: Boolean(w.custom),
    light: Boolean(w.light),
    // план Б: ссылка на домашний вариант для уличных тренировок
    home: w.outdoor && !w.isHome ? 'h-' + w.ref : null,
    baseRef: w.baseRef || null,
    minutes: estimateMin(w.exercises),
    count: w.exercises.filter((e) => e.phase === 'main').length,
    ball: w.exercises.some((e) => e.cat),
  };
}

function customOf(user) {
  return db.prepare('SELECT * FROM custom_workouts WHERE user_id = ?').all(user.id).map((r) => ({
    ref: 'c' + r.id, weekday: r.weekday, slot: r.slot, title: r.title, focus: r.focus,
    custom: true, exercises: JSON.parse(r.exercises_json),
  }));
}

function allCards(user) {
  return [...generated(user), ...customOf(user)].map(card)
    .sort((a, b) => a.weekday - b.weekday || SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]);
}

// ref: g3m (план, среда утро), c5 (своя, только владельцу), l-juggling (урок)
function findWorkout(user, ref) {
  const s = String(ref);
  if (/^g[1-7][me]$/.test(s)) {
    const w = generated(user).find((x) => x.ref === s);
    return w ? { ...card(w), exercises: w.exercises } : null;
  }
  const hm = /^h-(g[1-7][me]|s-[A-Z0-9]{3,6})$/.exec(s);
  if (hm) return homeWorkout(user, hm[1]);
  const cat = /^s-([A-Z0-9]{3,6})$/.exec(s);
  if (cat && SESSIONS[cat[1]]) return catalogWorkout(user, cat[1]);
  const m = /^c(\d{1,9})$/.exec(s);
  if (m) {
    const w = customOf(user).find((x) => x.ref === s);
    return w ? { ...card(w), exercises: w.exercises } : null;
  }
  const l = /^l-([a-z0-9-]{1,40})$/.exec(s);
  if (l && lessonById[l[1]]) {
    const w = buildLessonWorkout(user, lessonById[l[1]]);
    return w ? { ...card(w), exercises: w.exercises } : null;
  }
  return null;
}

// домашний вариант (план Б) уличной тренировки: те же цель и уровень, но без стены, поля и шума
function homeWorkout(user, baseRef) {
  let code = null; let variant = 1; let base = null;
  if (baseRef.startsWith('s-')) {
    code = baseRef.slice(2);
    if (!SESSIONS[code]) return null;
    base = catalogWorkout(user, code);
  } else {
    const g = generated(user).find((x) => x.ref === baseRef);
    if (!g) return null;
    ({ code, variant } = g);
    base = { ...card(g), exercises: g.exercises };
  }
  if (!SESSIONS[code].outdoor) return null;
  const hw = buildSession(user, code, variant, { home: true });
  const w = { ref: 'h-' + baseRef, baseRef, weekday: base.weekday, slot: base.slot, isHome: true, outdoor: true, ...hw, title: 'Дома: ' + hw.title };
  return { ...card(w), exercises: w.exercises };
}

// тренировка из каталога: можно сделать в любой день, к расписанию не привязана
function catalogWorkout(user, code) {
  const def = SESSIONS[code];
  const w = { ref: 's-' + code, weekday: null, slot: def.group === 'ball' ? 'evening' : 'morning', light: Boolean(def.light), ...buildSession(user, code, 1) };
  return { ...card(w), exercises: w.exercises };
}

function catalog(user) {
  return SESSION_GROUPS.map((g) => ({
    key: g.key, label: g.label, text: g.text,
    items: Object.keys(SESSIONS).filter((c) => SESSIONS[c].group === g.key).map((c) => {
      const w = catalogWorkout(user, c);
      return { ref: w.ref, title: w.title, focus: w.focus, minutes: w.minutes, count: w.count, slot: w.slot, ball: w.ball, home: w.home };
    }),
  }));
}

// сколько дней назад пропущенная тренировка ещё переезжает; старше уже не догоняем
const CARRY_DAYS = 3;

// Плановые тренировки последних дней, которые не сделаны, переезжают вперёд: сначала в день без тренировок
// (выходной «съедается»), если выходных нет в ближайшую неделю, то в первый день со свободным утром или вечером.
// Состояния нет, всё считается из расписания и отчётов, поэтому ничего не ломается, если пропустил несколько дней.
function carryOver(user, today, cards, last) {
  const created = String(user.created_at || '').slice(0, 10);
  const from = addDays(today, -CARRY_DAYS);
  const start = created > from ? created : from;
  if (start >= today) return new Map();
  const plan = cards.filter((c) => /^g[1-7][me]$/.test(c.ref) && !c.light);
  const missed = [];
  for (let d = start; d < today; d = addDays(d, 1)) {
    for (const c of plan) {
      if (c.weekday !== weekdayOf(d)) continue;
      if (d === created && c.slot === 'morning') continue; // в день регистрации утро ещё не могло быть сделано
      if ((last.get(c.ref) || '') >= d) continue;
      missed.push({ ...c, moved: true, fromDate: d });
    }
  }
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const placed = new Map();
  const busy = (d, slot) => cards.some((c) => c.weekday === weekdayOf(d) && c.slot === slot) || (placed.get(d) || []).some((c) => c.slot === slot);
  for (const m of missed) {
    const free = days.filter((d) => !busy(d, m.slot) && !(placed.get(d) || []).length);
    const rest = free.find((d) => !cards.some((c) => c.weekday === weekdayOf(d)));
    const target = rest || free[0];
    if (target) placed.set(target, [...(placed.get(target) || []), m]);
  }
  return placed;
}

// неделя вокруг даты: по дням, с отметкой «сделано», «пропущена» и «перенесена»
function weekPlan(user, today) {
  const dates = weekDates(today);
  const cards = allCards(user);
  const lo = dates[0];
  // последняя дата отчёта по каждой тренировке: сделана позже срока, значит выполнена
  const last = new Map(db.prepare('SELECT ref, MAX(date) AS d FROM reports WHERE user_id = ? AND date >= ? GROUP BY ref').all(user.id, addDays(lo, -CARRY_DAYS)).map((r) => [r.ref, r.d]));
  const placed = carryOver(user, today, cards, last);
  const hi = [dates[6], addDays(today, 6)].sort().pop();
  const done = new Set(
    db.prepare('SELECT date, ref FROM reports WHERE user_id = ? AND date BETWEEN ? AND ?').all(user.id, lo, hi).map((r) => `${r.date}|${r.ref}`)
  );
  const created = String(user.created_at || '').slice(0, 10);
  return dates.map((date, i) => {
    const base = cards.filter((c) => c.weekday === i + 1).map((c) => {
      const isDone = done.has(`${date}|${c.ref}`);
      const missed = !isDone && date < today && date >= created && !(date === created && c.slot === 'morning') && /^g/.test(c.ref) && !c.light && (last.get(c.ref) || '') < date;
      return { ...c, done: isDone, missed, time: user['remind_' + c.slot] || null };
    });
    const moved = (placed.get(date) || []).map((c) => ({ ...c, done: done.has(`${date}|${c.ref}`), time: user['remind_' + c.slot] || null }));
    // перенесённая и уже сделанная остаётся в том дне, когда её сделали
    for (const c of cards) {
      if (c.weekday === i + 1 || !/^g/.test(c.ref) || !done.has(`${date}|${c.ref}`)) continue;
      if (!moved.some((m) => m.ref === c.ref)) moved.push({ ...c, moved: true, done: true });
    }
    return {
      weekday: i + 1, date, isToday: date === today,
      sessions: [...base, ...moved].sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot]),
    };
  });
}

function daySessions(user, date) {
  return weekPlan(user, date)[weekdayOf(date) - 1].sessions;
}

// дней подряд с отчётом; если сегодня ещё нет, серия считается до вчера
function streakOf(userId, today) {
  const dates = new Set(db.prepare('SELECT DISTINCT date FROM reports WHERE user_id = ?').all(userId).map((r) => r.date));
  let d = dates.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (dates.has(d)) { n++; d = addDays(d, -1); }
  return n;
}

module.exports = { allCards, findWorkout, weekPlan, daySessions, streakOf, catalog };
