// Время напоминаний и подписка браузера на уведомления.
const express = require('express');
const { db } = require('../db');
const { auth } = require('../lib/auth');
const push = require('../lib/push');

const router = express.Router();
router.use(auth);

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

router.get('/reminders', (req, res) => {
  const u = req.user;
  const subs = db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ?').get(u.id).n;
  res.json({ morning: u.remind_morning, evening: u.remind_evening, tz: u.tz, subscribed: subs > 0, publicKey: push.publicKey });
});

router.put('/reminders', (req, res) => {
  const b = req.body || {};
  const t = (v) => (v === null || v === undefined || v === '' ? null : v);
  const morning = t(b.morning);
  const evening = t(b.evening);
  if ((morning !== null && !TIME_RE.test(String(morning))) || (evening !== null && !TIME_RE.test(String(evening)))) {
    return res.status(400).json({ error: 'Время нужно в виде ЧЧ:ММ, например 19:30.' });
  }
  if (!push.okTz(b.tz)) return res.status(400).json({ error: 'Не удалось определить часовой пояс.' });
  db.prepare('UPDATE users SET remind_morning = ?, remind_evening = ?, tz = ? WHERE id = ?').run(morning, evening, b.tz, req.user.id);
  res.json({ ok: true });
});

router.post('/push/subscribe', (req, res) => {
  const { endpoint, keys } = req.body || {};
  if (!push.okEndpoint(endpoint) || typeof keys?.p256dh !== 'string' || typeof keys?.auth !== 'string' || keys.p256dh.length > 200 || keys.auth.length > 100) {
    return res.status(400).json({ error: 'Подписка браузера не подошла.' });
  }
  const n = db.prepare('SELECT COUNT(*) AS n FROM push_subs WHERE user_id = ? AND endpoint != ?').get(req.user.id, endpoint).n;
  if (n >= 5) return res.status(400).json({ error: 'Устройств с уведомлениями может быть не больше пяти.' });
  db.prepare('INSERT INTO push_subs (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth')
    .run(req.user.id, endpoint, keys.p256dh, keys.auth);
  res.status(201).json({ ok: true });
});

router.post('/push/unsubscribe', (req, res) => {
  db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(req.user.id, String(req.body?.endpoint || ''));
  res.json({ ok: true });
});

router.post('/push/test', async (req, res) => {
  const sent = await push.sendTo(req.user.id, { title: 'QuorFootball', body: 'Уведомления работают. Дальше напомню в твоё время.', url: '/#/' });
  if (!sent) return res.status(400).json({ error: 'Не получилось отправить. Включи уведомления на этом устройстве ещё раз.' });
  res.json({ sent });
});

module.exports = router;
