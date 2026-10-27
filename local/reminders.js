// Напоминания на телефоне: локальные уведомления Android, никакого сервера и интернета.
// Расписание на две недели пересоздаём при открытии приложения, смене времени и новом отчёте.
const { db } = require('./db');
const { weekPlan, allCards } = require('../lib/workouts');
const { weekdayOf } = require('../lib/util');

const SLOTS = [['morning', 1, 'Утренняя тренировка'], ['evening', 2, 'Вечерняя тренировка']];
const DAYS = 14;

const native = () => typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
// плагин оборачиваем в объект: если вернуть его из async-функции напрямую, JS позовёт у него .then() и Capacitor упадёт
const plugin = async () => ({ LN: (await import('@capacitor/local-notifications')).LocalNotifications });
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

async function status() {
  if (!native()) return 'unsupported';
  const { LN } = await plugin();
  return (await LN.checkPermissions()).display;
}

async function enable() {
  if (!native()) return 'unsupported';
  const { LN } = await plugin();
  const r = await LN.requestPermissions();
  await reschedule();
  return r.display;
}

let busy = false;
async function reschedule() {
  if (!native() || busy) return;
  busy = true;
  try {
    const { LN } = await plugin();
    if ((await LN.checkPermissions()).display !== 'granted') return;
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const user = db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get();
    if (!user) return;
    const now = new Date();
    const today = ymd(now);
    // эта неделя считается с учётом переносов, дальше по обычному расписанию
    const week = new Map(weekPlan(user, today).map((d) => [d.date, d.sessions]));
    const cards = allCards(user);
    const notes = [];
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const date = ymd(d);
      const sessions = week.get(date) || cards.filter((c) => c.weekday === weekdayOf(date)).map((c) => ({ ...c, done: false }));
      for (const [slot, code, title] of SLOTS) {
        const time = user[`remind_${slot}`];
        const s = sessions.find((x) => x.slot === slot && !x.done);
        if (!time || !s) continue;
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(time.slice(0, 2)), Number(time.slice(3)));
        if (at <= now) continue;
        notes.push({ id: i * 10 + code, title, body: `${s.title}, ${s.minutes} мин. Начнём?`, schedule: { at, allowWhileIdle: true }, extra: { url: `#/workout/${s.ref}` } });
      }
    }
    if (notes.length) await LN.schedule({ notifications: notes });
  } catch (e) {
    console.error('напоминания:', e && e.message);
  } finally { busy = false; }
}

// пробное уведомление через пять секунд
async function test() {
  const { LN } = await plugin();
  await LN.schedule({ notifications: [{ id: 9999, title: 'QuorFootball', body: 'Уведомления работают. Дальше напомню в твоё время.', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true }, extra: { url: '#/' } }] });
}

async function listen() {
  if (!native()) return;
  const { LN } = await plugin();
  LN.addListener('localNotificationActionPerformed', (e) => {
    const url = e?.notification?.extra?.url;
    if (typeof url === 'string' && url.startsWith('#/')) location.hash = url;
  });
}

module.exports = { native, status, enable, reschedule, test, listen };
