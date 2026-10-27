// SQLite из самого Node (node:sqlite), ничего компилировать не надо.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { SCHEMA } = require('./lib/schema');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(process.env.DB_PATH || path.join(dir, 'football.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(SCHEMA);

// база от первой версии: добавляем недостающие колонки, старую таблицу тренировок убираем
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
if (!cols.includes('equipment')) db.exec("ALTER TABLE users ADD COLUMN equipment TEXT NOT NULL DEFAULT '[\"ball\",\"wall\"]'");
if (!cols.includes('dumbbell_kg')) db.exec('ALTER TABLE users ADD COLUMN dumbbell_kg REAL');
for (const c of ['remind_morning', 'remind_evening', 'tz']) {
  if (!cols.includes(c)) db.exec(`ALTER TABLE users ADD COLUMN ${c} TEXT`);
}
db.exec('DROP TABLE IF EXISTS workouts');

module.exports = { db };
