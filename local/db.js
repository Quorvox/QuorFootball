// База в приложении: sql.js (SQLite в WebAssembly) с тем же интерфейсом, что у node:sqlite.
// Маршруты сервера работают с ней без изменений. Файл базы сохраняется в IndexedDB после записи.
const { SCHEMA } = require('../lib/schema');
const storage = require('./storage');

let inner = null;
let timer = null;

const norm = (params) => params.map((p) => (p === undefined ? null : p));

function save() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    try { await storage.put('db', 'main', inner.export()); } catch (e) { console.error('не удалось сохранить базу', e); }
  }, 250);
}

const db = {
  prepare(sql) {
    return {
      get(...params) {
        const st = inner.prepare(sql);
        try {
          st.bind(norm(params));
          return st.step() ? st.getAsObject() : undefined;
        } finally { st.free(); }
      },
      all(...params) {
        const st = inner.prepare(sql);
        const out = [];
        try {
          st.bind(norm(params));
          while (st.step()) out.push(st.getAsObject());
        } finally { st.free(); }
        return out;
      },
      run(...params) {
        inner.run(sql, norm(params));
        const changes = inner.getRowsModified();
        const rowid = inner.exec('SELECT last_insert_rowid()')[0].values[0][0];
        save();
        return { changes, lastInsertRowid: rowid };
      },
    };
  },
  exec(sql) { inner.exec(sql); save(); },
};

// поднимаем sql.js и загружаем сохранённую базу (или создаём новую)
async function init(initSqlJs, wasmBinary) {
  const SQL = await initSqlJs({ wasmBinary });
  const saved = await storage.get('db', 'main');
  inner = saved ? new SQL.Database(saved) : new SQL.Database();
  inner.run('PRAGMA foreign_keys = ON');
  inner.exec(SCHEMA);
  return db;
}

module.exports = { db, init, flush: () => (inner ? storage.put('db', 'main', inner.export()) : Promise.resolve()) };
