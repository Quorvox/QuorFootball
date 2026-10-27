// Перенос пропущенных тренировок: на отдельной базе, без сервера. Запускается в npm run check.
const path = require('path');
const fs = require('fs');
const tmp = path.join(__dirname, '..', '.test');
fs.mkdirSync(tmp, { recursive: true });
process.env.DB_PATH = path.join(tmp, 'carry.db');
for (const f of ['carry.db', 'carry.db-shm', 'carry.db-wal']) fs.rmSync(path.join(tmp, f), { force: true });

const { db } = require('../db');
const { weekPlan } = require('../lib/workouts');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };

// средний уровень: вторник утро+вечер, среда выходной, суббота выходной
db.prepare("INSERT INTO users (id, token_hash, name, sex, age, height, weight, level, goal, position, equipment, created_at) VALUES (1, 'x', 'T', 'm', 19, 178, 70, 'middle', 'maintain', 'mid', '[\"ball\",\"wall\"]', '2026-10-27 17:30:00')").run();
const u = db.prepare('SELECT * FROM users WHERE id = 1').get();
const day = (today, date) => weekPlan(u, today).find((d) => d.date === date);

const tue = day('2026-10-27', '2026-10-27');
ok(tue.sessions.length === 2 && !tue.sessions.some((s) => s.missed || s.moved), 'в день регистрации ничего не пропущено');

const wed = day('2026-10-28', '2026-10-28');
ok(wed.sessions.length === 1 && wed.sessions[0].ref === 'g2e' && wed.sessions[0].moved, 'вечер вторника переехал на выходную среду');
ok(wed.sessions[0].fromDate === '2026-10-27' && wed.sessions[0].slot === 'evening', 'у перенесённой помечено, откуда, и вечер остался вечером');
const tue2 = day('2026-10-28', '2026-10-27');
ok(tue2.sessions.find((s) => s.ref === 'g2e').missed && !tue2.sessions.find((s) => s.ref === 'g2m').missed, 'во вторнике вечер пропущен, утро в день регистрации не считается');
ok(day('2026-10-28', '2026-10-29').sessions.length === 2, 'чужие дни не тронуты');

db.prepare("INSERT INTO reports (user_id, date, ref, title, slot) VALUES (1, '2026-10-28', 'g2e', 'x', 'evening')").run();
const wed2 = day('2026-10-28', '2026-10-28');
ok(wed2.sessions.length === 1 && wed2.sessions[0].done, 'сделанная перенесённая остаётся в среде как сделанная');
ok(!day('2026-10-28', '2026-10-27').sessions.find((s) => s.ref === 'g2e').missed, 'во вторнике пометка «пропущена» ушла');
ok(day('2026-10-29', '2026-10-30').sessions.length === 2 && !day('2026-10-29', '2026-10-29').sessions.some((s) => s.moved), 'на следующий день ничего лишнего не переносится');

// тренировки старше трёх дней не догоняем, второй за день не добавляем
db.prepare('DELETE FROM reports').run();
const fri = weekPlan(u, '2026-10-30');
ok(fri.flatMap((d) => d.sessions).filter((s) => s.moved).length >= 1, 'при долгом пропуске часть переносится');
ok(fri.every((d) => d.sessions.filter((s) => s.moved).length <= 1), 'на день переносится не больше одной тренировки');
const sun = weekPlan(u, '2026-11-08');
ok(sun.flatMap((d) => d.sessions).every((s) => !s.moved || s.fromDate >= '2026-11-05'), 'старше трёх дней не переносим');

process.exit(fails ? 1 : 0);
