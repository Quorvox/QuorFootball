// Время напоминаний в приложении: хранится в профиле, уведомления ставит reminders.js.
const express = require('express');
const { db } = require('./db');
const { auth } = require('./auth');
const reminders = require('./reminders');

const router = express.Router();
router.use(auth);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const okTz = (tz) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length <= 64; } catch { return false; }
};

router.get('/reminders', async (req, res) => {
  const u = req.user;
  const d = await reminders.details();
  res.json({ morning: u.remind_morning, evening: u.remind_evening, tz: u.tz, subscribed: d.permission === 'granted', native: true, permission: d.permission, fullScreenAllowed: d.fullScreen, loud: reminders.getPrefs() });
});

router.put('/reminders', (req, res) => {
  const b = req.body || {};
  const t = (v) => (v === null || v === undefined || v === '' ? null : v);
  const morning = t(b.morning);
  const evening = t(b.evening);
  if ((morning !== null && !TIME_RE.test(String(morning))) || (evening !== null && !TIME_RE.test(String(evening)))) {
    return res.status(400).json({ error: 'Время нужно в виде ЧЧ:ММ, например 19:30.' });
  }
  if (!okTz(b.tz)) return res.status(400).json({ error: 'Не удалось определить часовой пояс.' });
  db.prepare('UPDATE users SET remind_morning = ?, remind_evening = ?, tz = ? WHERE id = ?').run(morning, evening, b.tz, req.user.id);
  if (b.loud && typeof b.loud === 'object') reminders.setPrefs(b.loud);
  reminders.reschedule();
  res.json({ ok: true });
});

router.post('/reminders/enable', async (req, res) => {
  const perm = await reminders.enable();
  res.json({ permission: perm });
});

router.post('/reminders/settings', async (req, res) => {
  const what = req.body && req.body.what === 'fullscreen' ? 'fullscreen' : 'notifications';
  await reminders.openSettings(what);
  res.json({ ok: true });
});

router.post('/reminders/test', async (req, res) => {
  if ((await reminders.status()) !== 'granted') return res.status(400).json({ error: 'Сначала включи уведомления и разреши их в Android.' });
  await reminders.test();
  res.json({ ok: true });
});

module.exports = router;
