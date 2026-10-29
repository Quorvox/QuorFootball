// Автономный режим (приложение без сервера): те же сценарии, но через window.QF_LOCAL. Запускается в npm run check.
const path = require('path');
const fs = require('fs');
const { bundle } = require('./bundle-local');

const tmp = path.join(__dirname, '..', '.test');
fs.mkdirSync(tmp, { recursive: true });
const out = path.join(tmp, 'local-node.js');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

(async () => {
  await bundle({ platform: 'node', outfile: out, minify: false });
  require(out);
  const L = globalThis.QF_LOCAL;
  await L.ready;
  const call = (m, u, b) => L.request(m, u, b);

  ok((await call('GET', '/api/me')).data.user === null, 'приложение: без профиля user: null');
  ok((await call('GET', '/api/plan?today=2026-10-27')).status === 401, 'приложение: план без профиля закрыт');
  const cat = await call('GET', '/api/catalog');
  ok(cat.data.equipment.length >= 11 && cat.data.levels.length === 3, 'приложение: каталог оборудования');

  const bad = { name: 'Тест', sex: 'm', age: 5, height: 172, weight: 62, level: 'novice', goal: 'lose', position: 'fwd' };
  ok((await call('POST', '/api/profile', bad)).status === 400, 'приложение: кривой возраст отклонён');
  const p = await call('POST', '/api/profile', { ...bad, age: 17, equipment: ['ball', 'wall', 'bar', 'dumbbells', 'chair', 'bogus'], dumbbell_kg: 8 });
  ok(p.status === 201, 'приложение: профиль создан');
  const me = (await call('GET', '/api/me')).data.user;
  ok(me.name === 'Тест' && me.equipment.join() === 'ball,wall,bar,dumbbells,chair', 'приложение: профиль и оборудование сохранены');

  const pl = await call('GET', '/api/plan?today=2026-10-27');
  ok(pl.data.days.length === 7 && pl.data.days[0].date === '2026-10-26', 'приложение: план на неделю');
  const first = pl.data.days.flatMap((d) => d.sessions)[0];
  const w = await call('GET', '/api/workout/' + first.ref);
  ok(w.status === 200 && w.data.exercises.filter((e) => e.phase === 'main').length >= 3, 'приложение: тренировка открывается');
  const homeCard = pl.data.days.flatMap((d) => d.sessions).find((x) => x.home);
  ok(Boolean(homeCard) && (await call('GET', '/api/workout/' + homeCard.home)).data.baseRef === homeCard.ref, 'приложение: план Б собирается');

  const dr = await call('GET', '/api/drills');
  ok(dr.status === 200 && dr.data.cats.length >= 5 && dr.data.cats.flatMap((c) => c.items).length >= 30, 'приложение: школа мяча отдаёт упражнения');

  const n = await call('GET', '/api/nutrition');
  ok(n.data.minor && n.data.meals.length === 5, 'приложение: питание считается');
  ok((await call('POST', '/api/water', { date: '2026-10-27', delta: 250 })).data.ml === 250, 'приложение: вода +250');
  ok((await call('POST', '/api/water', { date: '2026-10-27', delta: -9999 })).status === 400, 'приложение: вода, большая дельта отклонена');
  ok((await call('POST', '/api/weight', { date: '2099-01-01', kg: 63.4 })).status === 200 && (await call('GET', '/api/me')).data.user.weight === 63.4, 'приложение: вес сохраняется в профиль');
  ok((await call('POST', '/api/records', { date: '2026-10-27', kind: 'juggle', value: 12 })).status === 201 && (await call('GET', '/api/records?kind=juggle')).data.best === 12, 'приложение: рекорд чеканки');
  ok((await call('GET', '/api/lessons')).data.items.length >= 11 && (await call('GET', '/api/lessons/city')).status === 200, 'приложение: уроки');
  const lib = await call('GET', '/api/library');
  ok(lib.data.groups.length === 4, 'приложение: каталог тренировок по группам');
  const cw = await call('POST', '/api/custom', { title: 'Моя', weekday: 2, slot: 'morning', items: [{ key: 'squat', sets: 3, amount: 15 }] });
  ok(cw.status === 201 && (await call('GET', '/api/workout/' + cw.data.ref)).status === 200, 'приложение: своя тренировка');

  // отчёт с фото
  const fd = new FormData();
  Object.entries({ date: '2026-10-27', ref: first.ref, durationSec: '900', rpe: '7', note: 'тест' }).forEach(([k, v]) => fd.append(k, v));
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'x.png');
  const rep = await call('POST', '/api/reports', fd);
  ok(rep.status === 201, 'приложение: отчёт с фото принят');
  const fdBad = new FormData();
  Object.entries({ date: '2026-10-27', ref: first.ref }).forEach(([k, v]) => fdBad.append(k, v));
  fdBad.append('photo', new Blob(['<html>'], { type: 'text/html' }), 'x.html');
  ok((await call('POST', '/api/reports', fdBad)).status === 400, 'приложение: html вместо фото отклонён');
  const list = await call('GET', '/api/reports');
  ok(list.data.items.length === 1 && /^blob:/.test(list.data.items[0].photo), 'приложение: фото в отчёте открывается по ссылке');
  ok((await call('GET', '/api/progress?today=2026-10-27')).data.total === 1, 'приложение: прогресс считает отчёт');

  // напоминания (в Node уведомлений нет, но время хранится)
  ok((await call('PUT', '/api/reminders', { morning: '25:00', evening: null, tz: 'Europe/Berlin' })).status === 400, 'приложение: кривое время напоминания отклонено');
  ok((await call('PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Europe/Berlin' })).status === 200, 'приложение: время напоминаний сохранено');
  const rem = (await call('GET', '/api/reminders')).data;
  ok(rem.evening === '19:30' && rem.native === true, 'приложение: напоминания читаются');
  ok((await call('GET', '/api/plan?today=2026-10-27')).data.days.flatMap((d) => d.sessions).some((x) => x.time === '19:30'), 'приложение: время видно в карточках');

  ok((await call('GET', '/api/nope')).status === 404, 'приложение: левый адрес даёт 404');
  ok((await call('DELETE', '/api/reports/' + rep.data.id)).status === 200 && (await call('GET', '/api/reports')).data.items.length === 0, 'приложение: отчёт удаляется');
  ok((await call('DELETE', '/api/me')).status === 200 && (await call('GET', '/api/me')).data.user === null, 'приложение: все данные удаляются');
  ok((await call('GET', '/api/nope')).status === 401, 'приложение: без профиля закрыто, как на сервере');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
