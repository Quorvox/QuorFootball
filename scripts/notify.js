// Логика напоминаний без сети: отправку подменяем и смотрим, кому и когда она бы ушла.
const path = require('path');
const fs = require('fs');
const tmp = path.join(__dirname, '..', '.test');
fs.mkdirSync(tmp, { recursive: true });
process.env.DB_PATH = path.join(tmp, 'notify.db');
for (const f of ['notify.db', 'notify.db-shm', 'notify.db-wal', 'vapid.json']) fs.rmSync(path.join(tmp, f), { force: true });

const webpush = require('web-push');
const sent = [];
webpush.sendNotification = async (sub, body) => { sent.push(JSON.parse(body)); };

const { db } = require('../db');
const push = require('../lib/push');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };

// вторник 2026-10-27: утро и вечер по плану; живёт в Берлине (UTC+1 после перехода на зимнее время)
db.prepare("INSERT INTO users (id, token_hash, name, sex, age, height, weight, level, goal, position, equipment, remind_morning, remind_evening, tz, created_at) VALUES (1, 'x', 'T', 'm', 19, 178, 70, 'middle', 'maintain', 'mid', '[\"ball\",\"wall\"]', '08:00', '19:30', 'Europe/Berlin', '2026-10-20 10:00:00')").run();
db.prepare("INSERT INTO push_subs (user_id, endpoint, p256dh, auth) VALUES (1, 'https://fcm.googleapis.com/fcm/send/x', 'a', 'b')").run();
const at = (iso) => new Date(iso);

(async () => {
  ok(push.localNow('Europe/Berlin', at('2026-10-27T18:35:00Z')).time === '19:35', 'местное время считается по часовому поясу');
  await push.tick(at('2026-10-27T18:00:00Z')); // 19:00 в Берлине
  ok(sent.length === 0, 'до назначенного времени ничего не шлём');
  await push.tick(at('2026-10-27T18:35:00Z')); // 19:35
  ok(sent.length === 1 && /Вечерняя/.test(sent[0].title) && /мин/.test(sent[0].body) && sent[0].url.startsWith('/#/workout/g2e'), 'в 19:35 приходит напоминание про вечернюю');
  await push.tick(at('2026-10-27T18:40:00Z'));
  ok(sent.length === 1, 'второй раз за день не шлём');
  await push.tick(at('2026-10-27T20:30:00Z')); // 21:30
  ok(sent.length === 1, 'через полчаса после времени уже не шлём');
  await push.tick(at('2026-10-27T07:05:00Z')); // 08:05
  ok(sent.length === 2 && /Утренняя/.test(sent[1].title), 'утром приходит про утреннюю');

  db.prepare("DELETE FROM notify_log").run();
  db.prepare("INSERT INTO reports (user_id, date, ref, title, slot) VALUES (1, '2026-10-27', 'g2e', 'x', 'evening')").run();
  await push.tick(at('2026-10-27T18:35:00Z'));
  ok(sent.length === 2, 'если вечерняя уже сделана, не напоминаем');

  await push.tick(at('2026-10-28T18:35:00Z')); // среда, выходной, но вторник сделан
  ok(sent.length === 2, 'в выходной напоминать не о чем');

  db.prepare('DELETE FROM push_subs').run();
  db.prepare("DELETE FROM notify_log").run();
  db.prepare("DELETE FROM reports").run();
  await push.tick(at('2026-10-27T18:35:00Z'));
  ok(sent.length === 2, 'без подписки на устройстве не шлём');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
