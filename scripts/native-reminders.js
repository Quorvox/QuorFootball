// Напоминания на телефоне без телефона: подставляем свой «родной модуль» и смотрим, что приложение ему отдаёт.
// Запускается в npm run check.
const path = require('path');
const fs = require('fs');
const { bundle } = require('./bundle-local');

const tmp = path.join(__dirname, '..', '.test');
fs.mkdirSync(tmp, { recursive: true });
const out = path.join(tmp, 'native-node.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };

const calls = [];
let perm = 'granted';
const Q = {
  status: async () => ({ notifications: perm, fullScreen: true }),
  ask: async () => ({ notifications: perm }),
  schedule: async (a) => { calls.push(['schedule', a]); },
  cancelAll: async () => { calls.push(['cancelAll']); },
  hold: async (a) => { calls.push(['hold', a]); },
  test: async (a) => { calls.push(['test', a]); },
  consume: async () => ({ events: [{ type: 'emergency', key: 'x' }], url: null }),
  addListener: () => {},
  openSettings: async (a) => { calls.push(['openSettings', a]); },
};
const mem = {};
globalThis.localStorage = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
globalThis.window = { Capacitor: { isNativePlatform: () => true, Plugins: { QFReminders: Q } }, dispatchEvent: () => {}, localStorage: globalThis.localStorage };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const last = () => calls.filter((c) => c[0] === 'schedule').pop()[1];

(async () => {
  await bundle({ platform: 'node', outfile: out, minify: false });
  require(out);
  const L = globalThis.QF_LOCAL;
  await L.ready;
  const call = (m, u, b) => L.request(m, u, b);
  ok(L.native === true, 'в приложении напоминания работают через родной модуль');

  const today = new Date();
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const base = { name: 'Тест', sex: 'm', age: 19, height: 172, weight: 62, level: 'middle', goal: 'gain', position: 'fwd', equipment: ['ball'] };
  ok((await call('POST', '/api/profile', base)).status === 201, 'профиль создан');

  // время напоминаний: ставим на завтра-вечер, чтобы «сегодня» не зависело от часов
  ok((await call('PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Europe/Berlin' })).status === 200, 'время сохранено');
  await sleep(300);
  let s = last();
  const keyRe = /^\d{4}-\d{2}-\d{2}\|(morning|evening)$/;
  ok(s.items.length >= 10 && s.items.every((i) => keyRe.test(i.key) && i.at > Date.now() && i.url.startsWith('#/workout/')), `расписание на две недели: ${s.items.length} напоминаний, все в будущем и ведут на тренировку`);
  ok(s.cfg.gap === 5 && s.cfg.max === 12 && s.cfg.fullScreen === true && s.cfg.repeat === true, 'повтор каждые 5 минут, до часа, на весь экран (по умолчанию)');
  ok(s.items.every((i) => /Начн/.test(i.body) && /тренировка/.test(i.title)), 'в тексте название и «Начнём?»');
  const at = new Date(s.items.find((i) => i.key.endsWith('evening')).at);
  ok(at.getHours() === 19 && at.getMinutes() === 30, 'вечернее напоминание в 19:30 по времени телефона');

  // галки «на весь экран» и «повторять» доходят до Android
  await call('PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Europe/Berlin', loud: { fullScreen: false, repeat: false } });
  await sleep(300);
  s = last();
  ok(s.cfg.fullScreen === false && s.cfg.repeat === false, 'настройки «без экрана» и «без повторов» передаются');
  ok((await call('GET', '/api/reminders')).data.loud.repeat === false, 'настройки читаются обратно');
  await call('PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Europe/Berlin', loud: { fullScreen: true, repeat: true } });
  await sleep(300);

  // сделанная тренировка исчезает из напоминаний и попадает в done
  const plan = (await call('GET', '/api/plan?today=' + ymd(today))).data;
  const day = plan.days.find((d) => d.date === ymd(today));
  const pick = day.sessions[0] || plan.days.flatMap((d) => d.sessions)[0];
  if (day.sessions.length) {
    const key = `${day.date}|${pick.slot}`;
    const fd = new FormData();
    Object.entries({ date: day.date, ref: pick.ref, durationSec: '900', rpe: '6' }).forEach(([k, v]) => fd.append(k, v));
    ok((await call('POST', '/api/reports', fd)).status === 201, 'отчёт сохранён');
    await sleep(300);
    s = last();
    ok(s.done.includes(key) && !s.items.some((i) => i.key === key), 'сделанная тренировка в done и больше не напоминается (повторы остановятся)');
  } else {
    ok(true, 'сегодня выходной: проверка done пропущена');
  }

  // без разрешения ничего не ставим
  perm = 'denied';
  const before = calls.length;
  await call('PUT', '/api/reminders', { morning: '09:00', evening: null, tz: 'Europe/Berlin' });
  await sleep(300);
  ok(calls.slice(before).every((c) => c[0] !== 'schedule'), 'без разрешения Android расписание не ставится');
  ok((await call('GET', '/api/reminders')).data.permission === 'denied', 'экран видит, что уведомления запрещены');
  perm = 'granted';

  // тренировка идёт: повторы молчат
  L.reminders.hold('evening');
  await sleep(100);
  ok(calls.some((c) => c[0] === 'hold' && /\|evening$/.test(c[1].key) && c[1].minutes === 60), 'на время тренировки повторы приостанавливаются на час');
  ok((await call('POST', '/api/reminders/settings', { what: 'fullscreen' })).status === 200 && calls.some((c) => c[0] === 'openSettings' && c[1].what === 'fullscreen'), 'можно открыть настройку полноэкранных уведомлений');

  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
