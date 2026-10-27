// Отчёт после тренировки: оценка, заметка, фото и видео (необязательно).
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { db } = require('../db');
const { auth } = require('../lib/auth');
const { isDate } = require('../lib/util');
const { findWorkout } = require('../lib/workouts');
const { uploadsDir, PHOTO_TYPES, VIDEO_TYPES, removeFiles } = require('../lib/files');

const MAX_FILE = 150 * 1024 * 1024;
const QUOTA = 1024 * 1024 * 1024; // 1 ГБ на человека

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadsDir,
    filename: (req, file, cb) => {
      const ext = { ...PHOTO_TYPES, ...VIDEO_TYPES }[file.mimetype];
      cb(null, crypto.randomUUID() + ext);
    },
  }),
  limits: { fileSize: MAX_FILE, files: 2, fields: 12 },
  fileFilter: (req, file, cb) => {
    const ok = (file.fieldname === 'photo' && PHOTO_TYPES[file.mimetype]) || (file.fieldname === 'video' && VIDEO_TYPES[file.mimetype]);
    cb(ok ? null : new Error('BAD_TYPE'), Boolean(ok));
  },
}).fields([{ name: 'photo', maxCount: 1 }, { name: 'video', maxCount: 1 }]);

const used = (id) => db.prepare('SELECT COALESCE(SUM(bytes), 0) AS n FROM reports WHERE user_id = ?').get(id).n;

function quotaCheck(req, res, next) {
  if (used(req.user.id) >= QUOTA) return res.status(413).json({ error: 'Место под файлы закончилось. Удали старые отчёты.' });
  next();
}

router.post('/reports', auth, quotaCheck, (req, res, next) => {
  upload(req, res, (err) => {
    if (err) return next(err);
    const files = req.files || {};
    const photo = files.photo?.[0];
    const video = files.video?.[0];
    const names = [photo?.filename, video?.filename];
    const fail = (code, error) => { removeFiles(names); return res.status(code).json({ error }); };

    const b = req.body || {};
    if (!isDate(b.date)) return fail(400, 'Нужна дата.');
    const w = findWorkout(req.user, b.ref);
    if (!w) return fail(404, 'Тренировка не найдена.');
    const dur = Math.round(Number(b.durationSec) || 0);
    const rpe = b.rpe === undefined || b.rpe === '' ? null : Number(b.rpe);
    if (dur < 0 || dur > 36000) return fail(400, 'Некорректная длительность.');
    if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) return fail(400, 'Оценка нагрузки от 1 до 10.');
    const note = String(b.note ?? '').trim().slice(0, 500);
    // название и слот берём из самой тренировки, а не от клиента
    const r = db.prepare(
      'INSERT INTO reports (user_id, date, ref, title, slot, duration_sec, rpe, note, photo, video, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, b.date, w.baseRef || w.ref, w.title, w.slot, dur, rpe, note, photo?.filename ?? null, video?.filename ?? null, (photo?.size || 0) + (video?.size || 0));
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
});

router.get('/reports', auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200').all(req.user.id);
  res.json({
    items: rows.map((r) => ({
      id: r.id, date: r.date, title: r.title, slot: r.slot, durationSec: r.duration_sec, rpe: r.rpe, note: r.note,
      photo: r.photo ? '/api/files/' + r.photo : null,
      video: r.video ? '/api/files/' + r.video : null,
    })),
    usedMb: Math.round(used(req.user.id) / 1048576),
  });
});

router.delete('/reports/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT photo, video FROM reports WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!r) return res.status(404).json({ error: 'Отчёт не найден.' });
  db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  removeFiles([r.photo, r.video]);
  res.json({ ok: true });
});

// файл отдаём только владельцу отчёта
router.get('/files/:name', auth, (req, res) => {
  const name = req.params.name;
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/.test(name)) return res.status(404).end();
  const own = db.prepare('SELECT 1 AS ok FROM reports WHERE user_id = ? AND (photo = ? OR video = ?)').get(req.user.id, name, name);
  if (!own) return res.status(404).end();
  res.sendFile(name, { root: uploadsDir, headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, max-age=3600' } });
});

module.exports = router;
