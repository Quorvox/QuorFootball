// SQLite из самого Node (node:sqlite), ничего компилировать не надо.
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const { SCHEMA, migrations } = require('./lib/schema');

const dir = path.join(__dirname, 'data');
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(process.env.DB_PATH || path.join(dir, 'football.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(SCHEMA);

// база от прошлых версий: добавляем недостающие колонки, старую таблицу тренировок убираем
const cols = db.prepare('PRAGMA table_info(users)').all().map((c) => c.name);
for (const sql of migrations(cols)) db.exec(sql);
db.exec('DROP TABLE IF EXISTS workouts');

module.exports = { db };
