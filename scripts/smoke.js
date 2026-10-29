// Прогон API на отдельной базе: npm run check
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const tmp = path.join(root, '.test');
fs.rmSync(tmp, { recursive: true, force: true });
fs.mkdirSync(path.join(tmp, 'uploads'), { recursive: true });

const PORT = 3199;
const base = `http://127.0.0.1:${PORT}`;
const srv = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', 'server.js'], {
  cwd: root,
  env: { ...process.env, PORT, DB_PATH: path.join(tmp, 't.db'), UPLOADS_DIR: path.join(tmp, 'uploads') },
  stdio: ['ignore', 'inherit', 'inherit'],
});

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(cookie, method, url, body) {
  const headers = cookie ? { cookie } : {};
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const r = await fetch(base + url, { method, headers, body: payload });
  const type = r.headers.get('content-type') || '';
  const data = type.includes('json') ? await r.json() : null;
  return { status: r.status, data, headers: r.headers };
}

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const mains = (w) => w.exercises.filter((e) => e.phase === 'main');

(async () => {
  for (let i = 0; i < 40; i++) { try { await fetch(base + '/api/me'); break; } catch { await sleep(150); } }

  const me0 = await call(null, 'GET', '/api/me');
  ok(me0.status === 200 && me0.data.user === null, 'без профиля /api/me отдаёт user: null');
  const cat = await call(null, 'GET', '/api/catalog');
  ok(cat.data.equipment.length >= 9 && cat.data.levels.length === 3, 'каталог уровней и оборудования');

  const bad = { name: 'X', sex: 'm', age: 16, height: 172, weight: 62, level: 'novice', goal: 'lose', position: 'fwd' };
  ok((await call(null, 'POST', '/api/profile', { ...bad, age: 5 })).status === 400, 'возраст 5 отклонён');
  ok((await call(null, 'POST', '/api/profile', { ...bad, equipment: ['dumbbells'] })).status === 400, 'гантели без веса отклонены');

  const p = await call(null, 'POST', '/api/profile', { ...bad, name: 'Тест', equipment: ['ball', 'wall', 'bar', 'dumbbells', 'chair', 'bogus'], dumbbell_kg: 8 });
  ok(p.status === 201, 'профиль создан');
  const cookie = (p.headers.get('set-cookie') || '').split(';')[0];
  ok(/HttpOnly/.test(p.headers.get('set-cookie') || ''), 'кука httpOnly');
  const me = await call(cookie, 'GET', '/api/me');
  ok(me.data.user.equipment.join() === 'ball,wall,bar,dumbbells,chair' && me.data.user.dumbbell_kg === 8, 'оборудование сохранено, левое отброшено');

  const n = await call(cookie, 'GET', '/api/nutrition');
  ok(n.data.calc.goalApplied === 'maintain' && n.data.minor, 'до 18 дефицит калорий не ставится');
  ok(n.data.meals.length === 5 && n.data.shopping.products.length > 0, 'рацион и покупки есть');

  const pl = await call(cookie, 'GET', '/api/plan?today=2026-10-27');
  ok(pl.data.days.length === 7 && pl.data.days[0].date === '2026-10-26', 'неделя с понедельника');
  const all = pl.data.days.flatMap((d) => d.sessions);
  ok(all.length === 7 && all.every((s) => /^g[1-7][me]$/.test(s.ref)), 'у новичка 3 тренировки с мячом, 3 силовых и восстановление');
  ok((await call(cookie, 'GET', '/api/plan?today=bad')).status === 400, 'кривая дата даёт 400');

  const upper = (await call(cookie, 'GET', '/api/workout/g3m')).data;
  const keys = mains(upper).map((e) => e.key);
  ok(keys.includes('neg_pullups') && keys.includes('incline_pushups'), 'есть турник и стул: негативные подтягивания и отжимания с опорой');
  ok(upper.exercises.some((e) => e.phase === 'warmup') && upper.exercises.some((e) => e.phase === 'cooldown'), 'есть разминка и заминка');
  ok(upper.exercises.every((e) => e.steps && e.steps.length), 'у каждого упражнения есть описание «как делать»');
  const legs = (await call(cookie, 'GET', '/api/workout/g1m')).data;
  ok(mains(legs).some((e) => e.load === 'по 8 кг'), 'гантели 8 кг: вес показан у упражнений');

  // второй человек без оборудования, уровень «опытный»
  const q = await call(null, 'POST', '/api/profile', { name: 'Другой', sex: 'f', age: 25, height: 165, weight: 55, level: 'pro', goal: 'gain', position: 'gk', equipment: [] });
  const cookie2 = q.headers.get('set-cookie').split(';')[0];
  const upper2 = (await call(cookie2, 'GET', '/api/workout/g2m')).data;
  const lib = (await call(cookie2, 'GET', '/api/exercises')).data;
  const libKeys = lib.groups.flatMap((g) => g.items.map((i) => i.key));
  ok(!mains(upper2).some((e) => ['pullups', 'chinups', 'dips', 'db_row', 'band_row'].includes(e.key)), 'без оборудования нет подтягиваний, брусьев и гантелей');
  ok(mains(upper2).length >= 4, 'без оборудования тренировка всё равно полная');
  ok(!libKeys.includes('pullups') && lib.hidden > 0, 'в базе упражнений скрыто то, на что нет оборудования');
  const noBall = (await call(cookie2, 'GET', '/api/workout/g1e')).data;
  ok(noBall.focus.includes('Мяча нет') && mains(noBall).length >= 3, 'без мяча вечер заменяется работой без мяча');
  ok((await call(cookie2, 'POST', '/api/custom', { title: 'Х', weekday: 2, slot: 'evening', items: [{ key: 'pullups', sets: 3, amount: 6 }] })).status === 400, 'в свою тренировку нельзя взять упражнение без оборудования');

  // свои тренировки
  const c = await call(cookie, 'POST', '/api/custom', { title: 'Моя', weekday: 2, slot: 'evening', withWarmup: true, items: [{ key: 'juggle', sets: 3, amount: 60 }] });
  ok(c.status === 201, 'своя тренировка создана');
  ok((await call(cookie, 'POST', '/api/custom', { title: 'Плохая', weekday: 2, slot: 'evening', items: [{ key: '__proto__', sets: 3, amount: 60 }] })).status === 400, 'левое упражнение отклонено');
  ok((await call(cookie2, 'GET', '/api/workout/' + c.data.ref)).status === 404, 'чужая своя тренировка недоступна');

  // школа
  const ls = await call(null, 'GET', '/api/lessons');
  ok(ls.data.items.length >= 9, 'уроки на месте');
  const les = await call(null, 'GET', '/api/lessons/juggling');
  ok(les.data.steps.length >= 5 && les.data.drills.length > 0 && les.data.videos.length > 0, 'урок про чеканку: шаги, упражнения, видео');
  ok((await call(null, 'GET', '/api/lessons/__proto__')).status === 404, 'левый урок даёт 404');
  const lw = await call(cookie, 'GET', '/api/workout/l-juggling');
  ok(lw.status === 200 && mains(lw.data).length >= 3, 'урок превращается в мини-тренировку');

  // рекорды
  ok((await call(cookie, 'POST', '/api/records', { date: '2026-10-27', kind: 'juggle', value: 12 })).status === 201, 'рекорд чеканки записан');
  await call(cookie, 'POST', '/api/records', { date: '2026-10-28', kind: 'juggle', value: 30 });
  const rec = await call(cookie, 'GET', '/api/records?kind=juggle');
  ok(rec.data.best === 30 && rec.data.items.length === 2, 'лучший результат и история чеканки');
  ok((await call(cookie, 'POST', '/api/records', { date: '2026-10-27', kind: 'juggle', value: 0 })).status === 400, 'нулевой рекорд отклонён');

  // вода и отчёты
  ok((await call(cookie, 'POST', '/api/water', { date: '2026-10-27', delta: 250 })).data.ml === 250, 'вода +250');
  ok((await call(cookie, 'POST', '/api/water', { date: '2026-10-27', delta: -9999 })).status === 400, 'вода: слишком большая дельта отклонена');

  const fd = new FormData();
  Object.entries({ date: '2026-10-27', ref: 'g3m', durationSec: '1200', rpe: '7', note: 'тест' }).forEach(([k, v]) => fd.append(k, v));
  fd.append('photo', new Blob([png], { type: 'image/png' }), 'x.png');
  ok((await call(cookie, 'POST', '/api/reports', fd)).status === 201, 'отчёт с фото принят');
  const fdL = new FormData();
  Object.entries({ date: '2026-10-27', ref: 'l-juggling', durationSec: '600' }).forEach(([k, v]) => fdL.append(k, v));
  ok((await call(cookie, 'POST', '/api/reports', fdL)).status === 201, 'отчёт по уроку принят');
  const badFd = new FormData();
  Object.entries({ date: '2026-10-27', ref: 'g3m' }).forEach(([k, v]) => badFd.append(k, v));
  badFd.append('photo', new Blob(['<html>'], { type: 'text/html' }), 'x.html');
  ok((await call(cookie, 'POST', '/api/reports', badFd)).status === 400, 'html вместо фото отклонён');
  ok((await call(cookie, 'POST', '/api/reports', (() => { const f = new FormData(); f.append('date', '2026-10-27'); f.append('ref', 'g9x'); return f; })())).status === 404, 'левая ссылка на тренировку отклонена');

  const list = await call(cookie, 'GET', '/api/reports');
  const withPhoto = list.data.items.find((i) => i.photo);
  ok(list.data.items.length === 2 && withPhoto, 'отчёты в списке');
  const f1 = await fetch(base + withPhoto.photo, { headers: { cookie } });
  ok(f1.status === 200 && f1.headers.get('content-type') === 'image/png', 'владелец видит свой файл');
  ok((await fetch(base + withPhoto.photo)).status === 401, 'без куки файл не получить');
  ok((await fetch(base + withPhoto.photo, { headers: { cookie: cookie2 } })).status === 404, 'файл другого человека недоступен');

  const t = await call(cookie, 'GET', '/api/today?date=2026-10-27');
  ok(t.data.streak === 1 && t.data.water.ml === 250, 'серия и вода на экране «Сегодня»');
  await call(cookie, 'POST', '/api/weight', { date: '2026-10-27', kg: 63.5 });
  const pr = await call(cookie, 'GET', '/api/progress?today=2026-10-27');
  ok(pr.data.total === 2 && pr.data.weights.some((x) => x.date === '2026-10-27' && x.kg === 63.5), 'прогресс: отчёты и вес');

  ok(fs.readdirSync(path.join(tmp, 'uploads')).length === 1, 'в uploads лежит только принятый файл');
  // каталог по группам, напоминания, подписки
  const catalogRes = await call(cookie, 'GET', '/api/library');
  ok(catalogRes.data.groups.map((g) => g.key).join() === 'strength,speed,ball,recovery' && catalogRes.data.groups.every((g) => g.items.length), 'каталог: четыре группы с тренировками');
  const sRef = catalogRes.data.groups[0].items[0].ref;
  const sw = await call(cookie, 'GET', '/api/workout/' + sRef);
  ok(sw.status === 200 && sw.data.weekday === null && mains(sw.data).length >= 3, 'тренировка из каталога открывается');
  ok((await call(cookie, 'GET', '/api/workout/s-NOPE')).status === 404, 'левая тренировка из каталога отклонена');
  ok((await call(cookie, 'PUT', '/api/reminders', { morning: '25:00', evening: null, tz: 'Europe/Berlin' })).status === 400, 'кривое время напоминания отклонено');
  ok((await call(cookie, 'PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Не/Пояс' })).status === 400, 'кривой часовой пояс отклонён');
  ok((await call(cookie, 'PUT', '/api/reminders', { morning: '08:00', evening: '19:30', tz: 'Europe/Berlin' })).status === 200, 'время напоминаний сохранено');
  const rem = await call(cookie, 'GET', '/api/reminders');
  ok(rem.data.evening === '19:30' && rem.data.subscribed === false && rem.data.publicKey.length > 60, 'напоминания читаются, ключ VAPID отдаётся');
  const pl2 = await call(cookie, 'GET', '/api/plan?today=2026-10-27');
  ok(pl2.data.days.flatMap((d) => d.sessions).some((x) => x.time === '19:30'), 'время видно в карточках тренировок');
  const evil = { keys: { p256dh: 'a', auth: 'b' } };
  ok((await call(cookie, 'POST', '/api/push/subscribe', { ...evil, endpoint: 'https://evil.example.com/x' })).status === 400, 'подписка на левый адрес отклонена');
  ok((await call(cookie, 'POST', '/api/push/subscribe', { ...evil, endpoint: 'http://127.0.0.1:8080/x' })).status === 400, 'подписка на локальный адрес отклонена');
  ok((await call(cookie, 'POST', '/api/push/subscribe', { ...evil, endpoint: 'https://fcm.googleapis.com/fcm/send/abc' })).status === 201, 'подписка на адрес Google принята');
  ok((await call(cookie, 'GET', '/api/reminders')).data.subscribed === true, 'подписка видна');
  ok((await call(cookie, 'POST', '/api/push/unsubscribe', { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' })).status === 200, 'отписка работает');
  ok((await call(null, 'GET', '/api/reminders')).status === 401, 'напоминания без входа закрыты');

  // план Б и город: без стены и двора, тихий режим
  ok(cat.data.equipment.some((e) => e.id === 'yard') && cat.data.equipment.some((e) => e.id === 'quiet'), 'в каталоге есть «двор» и «тихий режим»');
  const homeCard = pl2.data.days.flatMap((d) => d.sessions).find((x) => x.home);
  ok(Boolean(homeCard), 'у уличной тренировки есть ссылка на план Б');
  const hw = await call(cookie, 'GET', '/api/workout/' + homeCard.home);
  ok(hw.status === 200 && hw.data.baseRef === homeCard.ref && /^Дома: /.test(hw.data.title) && mains(hw.data).length >= 3, 'домашний вариант собирается');
  const WALL_DRILLS = ['Передачи в стену внутренней стороной', 'Удары подъёмом в стену', 'Приём мяча от стены'];
  ok(!hw.data.exercises.some((e) => WALL_DRILLS.includes(e.name)), 'в домашнем варианте нет упражнений со стеной');
  ok(hw.data.exercises.every((e) => !['Прыжки из приседа', 'Бёрпи', 'Скакалка', 'Прыжки «звезда»', 'Прыжки конькобежца'].includes(e.name)), 'в домашнем варианте нет шумных прыжков');
  ok((await call(cookie, 'GET', '/api/workout/h-g1m')).status === 404 && (await call(cookie, 'GET', '/api/workout/h-g9z')).status === 404, 'план Б для не-уличных и левых ссылок отклонён');
  const fdH = new FormData();
  Object.entries({ date: '2026-10-28', ref: homeCard.home, durationSec: '900', rpe: '6' }).forEach(([k, v]) => fdH.append(k, v));
  ok((await call(cookie, 'POST', '/api/reports', fdH)).status === 201, 'отчёт по домашнему варианту принят');
  const afterH = await call(cookie, 'GET', '/api/plan?today=2026-10-28');
  ok(afterH.data.days.flatMap((d) => d.sessions).some((x) => x.ref === homeCard.ref && x.done), 'домашний вариант засчитан как обычная тренировка');

  const city = await call(null, 'POST', '/api/profile', { name: 'Город', sex: 'm', age: 20, height: 180, weight: 72, level: 'middle', goal: 'maintain', position: 'mid', equipment: ['ball', 'quiet'] });
  const cityCookie = (city.headers.get('set-cookie') || '').split(';')[0];
  const cityPlan = await call(cityCookie, 'GET', '/api/plan?today=2026-10-28');
  const cityRefs = cityPlan.data.days.flatMap((d) => d.sessions).map((x) => x.ref);
  let cityNames = [];
  for (const r of cityRefs) cityNames = cityNames.concat((await call(cityCookie, 'GET', '/api/workout/' + r)).data.exercises.map((e) => e.name));
  ok(!cityNames.some((n) => WALL_DRILLS.includes(n)), 'городской профиль: ни одного упражнения со стеной');
  ok(cityNames.includes('Пас в «ворота»') && ['Гашение мяча на коврике', 'Приём от «давления»'].some((n) => cityNames.includes(n)), 'городской профиль: точность тренируется дома (пасы в ворота, гашение или приём)');
  const cityDrills = await call(cityCookie, 'GET', '/api/drills');
  const drillItems = cityDrills.data.cats.flatMap((c) => c.items);
  ok(cityDrills.status === 200 && cityDrills.data.cats.length >= 5 && drillItems.length >= 30, 'школа мяча: разделы и упражнения отдаются');
  ok(!drillItems.some((e) => WALL_DRILLS.includes(e.name)), 'школа мяча: без стены упражнений со стеной нет');
  const tight = await call(null, 'POST', '/api/profile', { name: 'Тесно', sex: 'm', age: 20, height: 180, weight: 72, level: 'middle', goal: 'maintain', position: 'mid', equipment: ['ball', 'tight', 'quiet'] });
  const tightCookie = (tight.headers.get('set-cookie') || '').split(';')[0];
  const tightDrills = (await call(tightCookie, 'GET', '/api/drills')).data;
  ok(tight.status === 201 && tightDrills.tight && tightDrills.cats.flatMap((c) => c.items).every((e) => e.space === 'tiny'), 'школа мяча: в тесном режиме только упражнения на месте');
  ok(!cityNames.some((n) => ['Бёрпи', 'Скакалка', 'Прыжки из приседа', 'Спринты 20 м'].includes(n)), 'тихий режим: шумные упражнения не берутся');
  await call(cityCookie, 'DELETE', '/api/me');

  ok((await call(cookie, 'DELETE', '/api/me')).status === 200, 'профиль удалён');
  await sleep(300);
  ok(fs.readdirSync(path.join(tmp, 'uploads')).length === 0, 'файлы удалены вместе с профилем');

  srv.kill();
  await sleep(300);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `\nпровалено: ${fails}` : '\nвсё прошло');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error(e); srv.kill(); process.exit(1); });
