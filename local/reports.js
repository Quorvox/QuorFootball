// Отчёты в приложении: то же, что на сервере, но фото и видео сохраняются на телефоне (IndexedDB).
const express = require('express');
const { db } = require('./db');
const { auth } = require('./auth');
const { isDate } = require('../lib/util');
const { findWorkout } = require('../lib/workouts');
const { PHOTO_TYPES, VIDEO_TYPES, removeFiles, fileUrl } = require('./files');
const storage = require('./storage');
const reminders = require('./reminders');

const MAX_FILE = 150 * 1024 * 1024;
const QUOTA = 1024 * 1024 * 1024;

const router = express.Router();

const used = (id) => db.prepare('SELECT COALESCE(SUM(bytes), 0) AS n FROM reports WHERE user_id = ?').get(id).n;
const uuid = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16)));

// сохраняем файл, если тип и размер подходят; иначе кидаем понятную ошибку
async function keep(blob, types) {
  if (!blob) return null;
  const ext = types[blob.type];
  if (!ext) throw Object.assign(new Error('Фото: jpg, png, webp. Видео: mp4, webm, mov.'), { code: 400 });
  if (blob.size > MAX_FILE) throw Object.assign(new Error('Файл больше 150 МБ.'), { code: 413 });
  const name = uuid() + ext;
  await storage.put('files', name, blob);
  return { name, size: blob.size };
}

router.post('/reports', auth, async (req, res) => {
  if (used(req.user.id) >= QUOTA) return res.status(413).json({ error: 'Место под файлы закончилось. Удали старые отчёты.' });
  const files = req.files || {};
  const saved = [];
  try {
    const b = req.body || {};
    if (!isDate(b.date)) return res.status(400).json({ error: 'Нужна дата.' });
    const w = findWorkout(req.user, b.ref);
    if (!w) return res.status(404).json({ error: 'Тренировка не найдена.' });
    const dur = Math.round(Number(b.durationSec) || 0);
    const rpe = b.rpe === undefined || b.rpe === '' ? null : Number(b.rpe);
    if (dur < 0 || dur > 36000) return res.status(400).json({ error: 'Некорректная длительность.' });
    if (rpe !== null && (!Number.isInteger(rpe) || rpe < 1 || rpe > 10)) return res.status(400).json({ error: 'Оценка нагрузки от 1 до 10.' });
    const note = String(b.note ?? '').trim().slice(0, 500);
    const photo = await keep(files.photo, PHOTO_TYPES);
    if (photo) saved.push(photo.name);
    const video = await keep(files.video, VIDEO_TYPES);
    if (video) saved.push(video.name);
    const r = db.prepare(
      'INSERT INTO reports (user_id, date, ref, title, slot, duration_sec, rpe, note, photo, video, bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(req.user.id, b.date, w.baseRef || w.ref, w.title, w.slot, dur, rpe, note, photo?.name ?? null, video?.name ?? null, (photo?.size || 0) + (video?.size || 0));
    reminders.reschedule();
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  } catch (e) {
    removeFiles(saved);
    if (e.code === 400 || e.code === 413) return res.status(e.code).json({ error: e.message });
    throw e;
  }
});

router.get('/reports', auth, async (req, res) => {
  const rows = db.prepare('SELECT * FROM reports WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 200').all(req.user.id);
  const items = [];
  for (const r of rows) {
    items.push({
      id: r.id, date: r.date, title: r.title, slot: r.slot, durationSec: r.duration_sec, rpe: r.rpe, note: r.note,
      photo: await fileUrl(r.photo), video: await fileUrl(r.video),
    });
  }
  res.json({ items, usedMb: Math.round(used(req.user.id) / 1048576) });
});

router.delete('/reports/:id', auth, (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT photo, video FROM reports WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!r) return res.status(404).json({ error: 'Отчёт не найден.' });
  db.prepare('DELETE FROM reports WHERE id = ?').run(id);
  removeFiles([r.photo, r.video]);
  res.json({ ok: true });
});

module.exports = router;
