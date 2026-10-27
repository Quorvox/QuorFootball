const express = require('express');
const { db } = require('../db');
const { auth, findUser, hash, newToken, cookieHeader } = require('../lib/auth');
const { cleanProfile } = require('../lib/validate');
const { removeFiles } = require('../lib/files');
const { LEVELS } = require('../data/levels');
const { EQUIPMENT } = require('../data/library');

const router = express.Router();

const parseEquip = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
const publicUser = (u) => ({
  name: u.name, sex: u.sex, age: u.age, height: u.height, weight: u.weight,
  level: u.level, goal: u.goal, position: u.position,
  equipment: parseEquip(u.equipment), dumbbell_kg: u.dumbbell_kg ?? null,
});
const levelList = Object.entries(LEVELS).map(([key, v]) => ({ key, label: v.label }));

// что умеет сервис: уровни и список оборудования (нужно до регистрации)
router.get('/catalog', (req, res) => res.json({ levels: levelList, equipment: EQUIPMENT }));

// от одного IP не больше 20 новых профилей в час, чтобы не забили базу
const hits = new Map();
function limitCreate(req, res, next) {
  const now = Date.now();
  const list = (hits.get(req.ip) || []).filter((t) => now - t < 3600000);
  if (list.length >= 20) return res.status(429).json({ error: 'Слишком много попыток. Попробуй позже.' });
  list.push(now);
  hits.set(req.ip, list);
  next();
}

router.post('/profile', limitCreate, (req, res) => {
  const { value, error } = cleanProfile(req.body);
  if (error) return res.status(400).json({ error });
  const token = newToken();
  const r = db.prepare(
    'INSERT INTO users (token_hash, name, sex, age, height, weight, level, goal, position, equipment, dumbbell_kg) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(hash(token), value.name, value.sex, value.age, value.height, value.weight, value.level, value.goal, value.position, JSON.stringify(value.equipment), value.dumbbell_kg);
  const today = new Date().toISOString().slice(0, 10);
  db.prepare('INSERT INTO weights (user_id, date, kg) VALUES (?, ?, ?)').run(r.lastInsertRowid, today, value.weight);
  res.setHeader('Set-Cookie', cookieHeader(token));
  res.status(201).json({ user: value });
});

// без профиля отвечаем 200 и user: null, чтобы в консоли не было красного
router.get('/me', (req, res) => {
  const user = findUser(req);
  res.json({ user: user ? publicUser(user) : null, levels: levelList });
});

router.put('/me', auth, (req, res) => {
  const { value, error } = cleanProfile({ ...publicUser(req.user), ...req.body });
  if (error) return res.status(400).json({ error });
  db.prepare('UPDATE users SET name=?, sex=?, age=?, height=?, weight=?, level=?, goal=?, position=?, equipment=?, dumbbell_kg=? WHERE id=?')
    .run(value.name, value.sex, value.age, value.height, value.weight, value.level, value.goal, value.position, JSON.stringify(value.equipment), value.dumbbell_kg, req.user.id);
  res.json({ user: value });
});

// удалить всё: профиль, отчёты, файлы (право на удаление данных)
router.delete('/me', auth, (req, res) => {
  const files = db.prepare('SELECT photo, video FROM reports WHERE user_id = ?').all(req.user.id);
  db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
  removeFiles(files.flatMap((f) => [f.photo, f.video]));
  res.setHeader('Set-Cookie', cookieHeader('', 0));
  res.json({ ok: true });
});

module.exports = router;
