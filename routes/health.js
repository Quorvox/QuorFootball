const express = require('express');
const { db } = require('../db');
const { auth } = require('../lib/auth');
const { isDate } = require('../lib/util');
const { allCards, weekPlan, streakOf } = require('../lib/workouts');
const { calc, meals, tips, shopping } = require('../data/plan');

const router = express.Router();
router.use(auth);

router.get('/nutrition', (req, res) => {
  const u = req.user;
  const days = new Set(allCards(u).map((c) => c.weekday)).size;
  const c = calc(u, days);
  res.json({
    calc: c,
    meals: meals(c.kcal),
    tips: tips(u),
    shopping: shopping(u, c.kcal),
    minor: u.age < 18,
  });
});

router.post('/water', (req, res) => {
  const { date, delta } = req.body || {};
  const d = Number(delta);
  if (!isDate(date)) return res.status(400).json({ error: 'Нужна дата.' });
  if (!Number.isInteger(d) || d < -2000 || d > 2000) return res.status(400).json({ error: 'Некорректный объём.' });
  const cur = db.prepare('SELECT ml FROM water WHERE user_id = ? AND date = ?').get(req.user.id, date)?.ml || 0;
  const ml = Math.min(10000, Math.max(0, cur + d));
  db.prepare('INSERT INTO water (user_id, date, ml) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET ml = excluded.ml')
    .run(req.user.id, date, ml);
  res.json({ ml });
});

router.post('/weight', (req, res) => {
  const { date } = req.body || {};
  const kg = Number(req.body?.kg);
  if (!isDate(date)) return res.status(400).json({ error: 'Нужна дата.' });
  if (!Number.isFinite(kg) || kg < 25 || kg > 250) return res.status(400).json({ error: 'Вес должен быть от 25 до 250 кг.' });
  const v = Math.round(kg * 10) / 10;
  db.prepare('INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?) ON CONFLICT(user_id, date) DO UPDATE SET kg = excluded.kg')
    .run(req.user.id, date, v);
  // профиль держит самый свежий вес, от него считается питание
  const last = db.prepare('SELECT kg FROM weights WHERE user_id = ? ORDER BY date DESC LIMIT 1').get(req.user.id);
  db.prepare('UPDATE users SET weight = ? WHERE id = ?').run(last.kg, req.user.id);
  res.json({ ok: true });
});

router.delete('/weight/:date', (req, res) => {
  if (!isDate(req.params.date)) return res.status(400).json({ error: 'Нужна дата.' });
  db.prepare('DELETE FROM weights WHERE user_id = ? AND date = ?').run(req.user.id, req.params.date);
  res.json({ ok: true });
});

// рекорды (пока только чеканка): запись раз в день, берём лучший за день
const RECORD_KINDS = ['juggle'];

router.get('/records', (req, res) => {
  const kind = String(req.query.kind || 'juggle');
  if (!RECORD_KINDS.includes(kind)) return res.status(400).json({ error: 'Неизвестный рекорд.' });
  const rows = db.prepare('SELECT date, MAX(value) AS value FROM records WHERE user_id = ? AND kind = ? GROUP BY date ORDER BY date').all(req.user.id, kind);
  const items = rows.map((r) => ({ date: r.date, value: r.value }));
  res.json({ items, best: items.reduce((m, r) => Math.max(m, r.value), 0) });
});

router.post('/records', (req, res) => {
  const { date, kind } = req.body || {};
  const value = Number(req.body?.value);
  if (!isDate(date)) return res.status(400).json({ error: 'Нужна дата.' });
  if (!RECORD_KINDS.includes(kind)) return res.status(400).json({ error: 'Неизвестный рекорд.' });
  if (!Number.isInteger(value) || value < 1 || value > 100000) return res.status(400).json({ error: 'Число касаний от 1 до 100000.' });
  const n = db.prepare('SELECT COUNT(*) AS n FROM records WHERE user_id = ?').get(req.user.id).n;
  if (n >= 5000) return res.status(400).json({ error: 'Слишком много записей.' });
  db.prepare('INSERT INTO records (user_id, date, kind, value) VALUES (?, ?, ?, ?)').run(req.user.id, date, kind, value);
  res.status(201).json({ ok: true });
});

router.get('/progress', (req, res) => {
  const today = String(req.query.today || '');
  if (!isDate(today)) return res.status(400).json({ error: 'Нужна дата.' });
  const u = req.user;
  const week = weekPlan(u, today);
  const sessions = week.flatMap((d) => d.sessions);
  res.json({
    total: db.prepare('SELECT COUNT(*) AS n FROM reports WHERE user_id = ?').get(u.id).n,
    streak: streakOf(u.id, today),
    week: { done: sessions.filter((s) => s.done).length, planned: sessions.length },
    weights: db.prepare('SELECT date, kg FROM weights WHERE user_id = ? ORDER BY date').all(u.id).map((w) => ({ ...w })),
  });
});

module.exports = router;
