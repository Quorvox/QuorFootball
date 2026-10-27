// Школа: уроки открыты всем, личного тут ничего нет.
const express = require('express');
const fs = require('fs');
const path = require('path');
const { LESSONS, byId } = require('../data/lessons');
const { LIB } = require('../data/library');

const router = express.Router();

const brief = (l) => ({ id: l.id, group: l.group, title: l.title, level: l.level, minutes: l.minutes, summary: l.summary });

router.get('/lessons', (req, res) => res.json({ items: LESSONS.map(brief) }));

router.get('/lessons/:id', (req, res) => {
  const l = Object.prototype.hasOwnProperty.call(byId, req.params.id) ? byId[req.params.id] : null;
  if (!l) return res.status(404).json({ error: 'Урок не найден.' });
  res.json({
    ...l,
    drills: l.practice.map((k) => ({ key: k, name: LIB[k].name, tip: LIB[k].tip, needs: LIB[k].needs })),
  });
});

// схемы лежат в public/img/lessons, отдаём список, чтобы клиент знал, что есть
router.get('/figures', (req, res) => {
  const dir = path.join(__dirname, '..', 'public', 'img', 'lessons');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)); } catch { /* нет папки */ }
  res.json({ items: files });
});

module.exports = router;
