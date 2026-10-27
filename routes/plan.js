const express = require('express');
const { db } = require('../db');
const { auth } = require('../lib/auth');
const { isDate, estimateMin } = require('../lib/util');
const { findWorkout, weekPlan, daySessions, streakOf, allCards, catalog } = require('../lib/workouts');
const { haveOf, ok, item } = require('../lib/build');
const { LEVELS } = require('../data/levels');
const { LIB, LIST, GROUPS } = require('../data/library');
const { WARM, WARM_BALL, COOL } = require('../data/program');
const { calc, tips } = require('../data/plan');

const router = express.Router();
router.use(auth);

const dateOr400 = (req, res) => {
  const d = String(req.query.today || req.query.date || '');
  if (!isDate(d)) { res.status(400).json({ error: 'Нужна дата в формате ГГГГ-ММ-ДД.' }); return null; }
  return d;
};

router.get('/plan', (req, res) => {
  const today = dateOr400(req, res);
  if (!today) return;
  res.json({ level: { key: req.user.level, label: LEVELS[req.user.level].label }, days: weekPlan(req.user, today) });
});

// все тренировки по группам: сила, скорость, мяч, восстановление
router.get('/library', (req, res) => res.json({ groups: catalog(req.user) }));

router.get('/workout/:ref', (req, res) => {
  const w = findWorkout(req.user, req.params.ref);
  if (!w) return res.status(404).json({ error: 'Тренировка не найдена.' });
  res.json(w);
});

// экран «Сегодня»: сессии, вода, серия, совет дня
router.get('/today', (req, res) => {
  const date = dateOr400(req, res);
  if (!date) return;
  const u = req.user;
  const sessions = daySessions(u, date);
  const days = new Set(allCards(u).map((c) => c.weekday)).size;
  const c = calc(u, days);
  const ml = db.prepare('SELECT ml FROM water WHERE user_id = ? AND date = ?').get(u.id, date)?.ml || 0;
  const list = tips(u);
  const dayNum = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 86400000);
  res.json({
    sessions,
    water: { ml, target: sessions.length ? c.waterTrain : c.waterRest },
    tip: list[dayNum % list.length],
    streak: streakOf(u.id, date),
  });
});

// база упражнений для конструктора: только то, что подходит под оборудование
router.get('/exercises', (req, res) => {
  const have = haveOf(req.user);
  const L = LEVELS[req.user.level];
  const dbKg = have.has('dumbbells') ? req.user.dumbbell_kg : null;
  let hidden = 0;
  const groups = GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    items: LIST.filter((e) => e.group === g.key).filter((e) => (ok(e.key, have) ? true : (hidden++, false)))
      .map((e) => {
        const it = item(e.key, req.user.level, 'main', L.sets, dbKg);
        return { key: e.key, name: e.name, kind: e.kind, amount: it.amount, sets: it.sets, tip: e.tip, load: it.load };
      }),
  })).filter((g) => g.items.length);
  res.json({ groups, hidden });
});

router.get('/custom', (req, res) => {
  const rows = db.prepare('SELECT * FROM custom_workouts WHERE user_id = ? ORDER BY weekday, id').all(req.user.id);
  res.json({ items: rows.map((r) => ({ id: r.id, ref: 'c' + r.id, title: r.title, weekday: r.weekday, slot: r.slot, minutes: estimateMin(JSON.parse(r.exercises_json)) })) });
});

router.post('/custom', (req, res) => {
  const b = req.body || {};
  const title = String(b.title ?? '').trim().slice(0, 60);
  const weekday = Number(b.weekday);
  if (!title) return res.status(400).json({ error: 'Дай тренировке название.' });
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return res.status(400).json({ error: 'Выбери день недели.' });
  if (!['morning', 'evening'].includes(b.slot)) return res.status(400).json({ error: 'Выбери утро или вечер.' });
  if (!Array.isArray(b.items) || b.items.length < 1 || b.items.length > 20) return res.status(400).json({ error: 'Добавь от 1 до 20 упражнений.' });
  const u = req.user;
  const have = haveOf(u);
  const dbKg = have.has('dumbbells') ? u.dumbbell_kg : null;
  const L = LEVELS[u.level];
  const main = [];
  for (const it of b.items) {
    const key = typeof it?.key === 'string' && Object.prototype.hasOwnProperty.call(LIB, it.key) ? it.key : null;
    const sets = Number(it?.sets);
    const amount = Number(it?.amount);
    if (!key) return res.status(400).json({ error: 'Неизвестное упражнение.' });
    if (!ok(key, have)) return res.status(400).json({ error: 'Для этого упражнения нужно оборудование, которого нет в профиле.' });
    if (!Number.isInteger(sets) || sets < 1 || sets > 6) return res.status(400).json({ error: 'Подходов может быть от 1 до 6.' });
    if (!Number.isInteger(amount) || amount < 5 || amount > 300) return res.status(400).json({ error: 'Повторов или секунд может быть от 5 до 300.' });
    main.push({ ...item(key, u.level, 'main', sets, dbKg), amount, rest: L.rest });
  }
  const withWarm = b.withWarmup !== false;
  const hasBall = main.some((m) => LIB[m.key].group === 'ball');
  const list = [
    ...(withWarm ? (hasBall ? WARM_BALL : WARM).map((k) => item(k, u.level, 'warmup', 1, dbKg)) : []),
    ...main,
    ...(withWarm ? COOL.map((k) => item(k, u.level, 'cooldown', 1, dbKg)) : []),
  ];
  const n = db.prepare('SELECT COUNT(*) AS n FROM custom_workouts WHERE user_id = ?').get(u.id).n;
  if (n >= 50) return res.status(400).json({ error: 'Своих тренировок может быть не больше 50.' });
  const r = db.prepare('INSERT INTO custom_workouts (user_id, weekday, slot, title, focus, exercises_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(u.id, weekday, b.slot, title, 'Своя тренировка', JSON.stringify(list));
  res.status(201).json({ ref: 'c' + r.lastInsertRowid });
});

router.delete('/custom/:id', (req, res) => {
  db.prepare('DELETE FROM custom_workouts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

module.exports = router;
