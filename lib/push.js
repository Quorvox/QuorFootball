// Напоминания: ключи VAPID, отправка и проверка раз в минуту, кому пора напомнить.
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');
const { db } = require('../db');
const { daySessions } = require('./workouts');

// ключ лежит рядом с базой (в Docker это отдельный том), иначе после пересборки подписки перестанут работать
const KEY_FILE = path.join(path.dirname(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'football.db')), 'vapid.json');

function loadKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  try { return JSON.parse(fs.readFileSync(KEY_FILE, 'utf8')); } catch { /* ещё нет */ }
  const keys = webpush.generateVAPIDKeys();
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, JSON.stringify(keys), { mode: 0o600 });
  return keys;
}

const keys = loadKeys();
webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://github.com/Quorvox', keys.publicKey, keys.privateKey);
const publicKey = keys.publicKey;

// принимаем только адреса настоящих пуш-сервисов браузеров, иначе сервер можно заставить ходить куда угодно
const PUSH_HOSTS = [/(^|\.)googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
function okEndpoint(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.port && PUSH_HOSTS.some((re) => re.test(u.hostname)) && url.length <= 600;
  } catch { return false; }
}

const okTz = (tz) => {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return typeof tz === 'string' && tz.length <= 64; } catch { return false; }
};

// местные дата и время человека
function localNow(tz, now = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: okTz(tz) ? tz : 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const p = Object.fromEntries(f.formatToParts(now).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

async function sendTo(userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subs WHERE user_id = ?').all(userId);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM push_subs WHERE id = ?').run(s.id);
    }
  }
  return sent;
}

const SLOT_TITLE = { morning: 'Утренняя тренировка', evening: 'Вечерняя тренировка' };

async function tick(now = new Date()) {
  const users = db.prepare('SELECT * FROM users WHERE (remind_morning IS NOT NULL OR remind_evening IS NOT NULL) AND id IN (SELECT user_id FROM push_subs)').all();
  for (const u of users) {
    const { date, time } = localNow(u.tz, now);
    for (const slot of ['morning', 'evening']) {
      const at = u['remind_' + slot];
      // напоминаем в течение получаса после времени: если сервер лежал, поздно не шлём
      if (!at || mins(time) < mins(at) || mins(time) - mins(at) > 30) continue;
      const s = daySessions(u, date).find((x) => x.slot === slot && !x.done);
      if (!s) continue;
      const fresh = db.prepare('INSERT OR IGNORE INTO notify_log (user_id, date, slot) VALUES (?, ?, ?)').run(u.id, date, slot).changes;
      if (!fresh) continue;
      await sendTo(u.id, { title: SLOT_TITLE[slot], body: `${s.title}, ${s.minutes} мин. Начнём?`, url: `/#/workout/${s.ref}` });
    }
  }
  db.prepare("DELETE FROM notify_log WHERE date < date('now', '-7 day')").run();
}

function start() {
  const t = setInterval(() => { tick().catch((e) => console.error('напоминания:', e.message)); }, 60000);
  t.unref();
}

module.exports = { publicKey, okEndpoint, okTz, localNow, sendTo, tick, start };
