// Напоминания в приложении: звонок как у будильника, полноэкранный экран и повтор, пока тренировка не сделана.
// Всё считает телефон, интернет не нужен. Расписание на две недели пересоздаём при открытии, смене времени и новом отчёте.
const { db } = require('./db');
const { weekPlan, allCards } = require('../lib/workouts');
const { weekdayOf } = require('../lib/util');

const SLOTS = [['morning', 'Утренняя тренировка'], ['evening', 'Вечерняя тренировка']];
const DAYS = 14;
const REPEAT_GAP_MIN = 5;
const REPEAT_MAX = 12; // 12 раз по 5 минут: час, потом оставляем в покое

const native = () => typeof window !== 'undefined' && Boolean(window.Capacitor?.isNativePlatform?.());
// плагин Android живёт в приложении (QFRemindersPlugin.java); оборачиваем, чтобы промис не пытался звать .then() у прокси
const plugin = () => {
  const Q = window.Capacitor.Plugins && window.Capacitor.Plugins.QFReminders;
  if (!Q) throw new Error('Модуль напоминаний не найден в приложении');
  return { Q };
};
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const PREFS_KEY = 'qf-remind-prefs';
function getPrefs() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { /* пусто */ }
  return { fullScreen: p.fullScreen !== false, repeat: p.repeat !== false };
}
function setPrefs(p) {
  const v = { fullScreen: Boolean(p && p.fullScreen), repeat: Boolean(p && p.repeat) };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(v)); } catch { /* приватный режим */ }
}

async function details() {
  if (!native()) return { permission: 'unsupported', fullScreen: false };
  const { Q } = plugin();
  const s = await Q.status();
  return { permission: s.notifications, fullScreen: s.fullScreen };
}

async function status() {
  return (await details()).permission;
}

async function enable() {
  if (!native()) return 'unsupported';
  const { Q } = plugin();
  const r = await Q.ask();
  await reschedule();
  return r.notifications;
}

// старые уведомления версий 1.0 и 1.1 ставил другой плагин: один раз убираем, чтобы не звонило дважды
async function dropLegacy() {
  try {
    if (localStorage.getItem('qf-legacy-cleaned')) return;
    const { LocalNotifications: LN } = window.Capacitor.Plugins;
    if (LN) {
      const pending = await LN.getPending();
      if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    }
    localStorage.setItem('qf-legacy-cleaned', '1');
  } catch { /* плагина нет, значит и чистить нечего */ }
}

let busy = false;
async function reschedule() {
  if (!native() || busy) return;
  busy = true;
  try {
    const { Q } = plugin();
    await dropLegacy();
    if ((await Q.status()).notifications !== 'granted') return;
    const user = db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get();
    if (!user) { await Q.cancelAll(); return; }
    const now = new Date();
    const today = ymd(now);
    // эта неделя считается с учётом переносов, дальше по обычному расписанию
    const week = new Map(weekPlan(user, today).map((d) => [d.date, d.sessions]));
    const cards = allCards(user);
    const items = [];
    const done = [];
    for (let i = -1; i < DAYS; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const date = ymd(d);
      const sessions = week.get(date) || cards.filter((c) => c.weekday === weekdayOf(date)).map((c) => ({ ...c, done: false }));
      for (const [slot, title] of SLOTS) {
        const s = sessions.find((x) => x.slot === slot);
        if (!s) continue;
        const key = `${date}|${slot}`;
        if (s.done) { done.push(key); continue; }
        const time = user[`remind_${slot}`];
        if (!time) continue;
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Number(time.slice(0, 2)), Number(time.slice(3)));
        if (at <= now) continue;
        items.push({ key, at: at.getTime(), title, body: `${s.title}, ${s.minutes} мин. Начнём?`, url: `#/workout/${s.ref}` });
      }
    }
    const p = getPrefs();
    await Q.schedule({ items, done, cfg: { fullScreen: p.fullScreen, repeat: p.repeat, gap: REPEAT_GAP_MIN, max: REPEAT_MAX } });
  } catch (e) {
    console.error('напоминания:', e && e.message);
  } finally { busy = false; }
}

// пробный звонок через несколько секунд
async function test() {
  const { Q } = plugin();
  await Q.test({ seconds: 8 });
}

// пока идёт тренировка, повторы молчат (час на тренировку); закончил, и reschedule их отменит
async function hold(slot) {
  if (!native()) return;
  try { await plugin().Q.hold({ key: `${ymd(new Date())}|${slot}`, minutes: 60 }); } catch { /* не критично */ }
}

// что нажали на телефоне, пока приложение было закрыто: «Начать» ведёт на тренировку, «Экстренно не могу» сообщаем человеку
async function consume() {
  if (!native()) return;
  try {
    const r = await plugin().Q.consume();
    if (r.url && typeof r.url === 'string' && r.url.startsWith('#/')) location.hash = r.url;
    const emergency = (r.events || []).filter((e) => e.type === 'emergency');
    // даём странице время подвесить слушатель после запуска
    if (emergency.length) setTimeout(() => window.dispatchEvent(new CustomEvent('qf-reminder', { detail: { emergency: emergency.length } })), 900);
  } catch { /* плагина нет */ }
}

async function listen() {
  if (!native()) return;
  const { Q } = plugin();
  Q.addListener('open', (e) => {
    if (e && typeof e.url === 'string' && e.url.startsWith('#/')) location.hash = e.url;
  });
  await consume();
}

// открыть системный экран настроек: полноэкранные уведомления или уведомления приложения
async function openSettings(what) {
  if (native()) await plugin().Q.openSettings({ what });
}

module.exports = { native, status, details, enable, reschedule, test, hold, consume, listen, getPrefs, setPrefs, openSettings };
