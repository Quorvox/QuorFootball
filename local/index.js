// Вход автономного режима: поднимаем базу и отдаём странице window.QF_LOCAL.request().
import initSqlJs from 'sql.js/dist/sql-wasm-browser.js';
import wasm from 'sql.js/dist/sql-wasm-browser.wasm';

const dbmod = require('./db');
const reminders = require('./reminders');

let api = null;
const ready = dbmod.init(initSqlJs, wasm).then(() => {
  api = require('./api');
  // уведомления необязательны: ошибка в них не должна мешать приложению открыться
  reminders.listen().catch((e) => console.error('уведомления:', e && e.message));
  reminders.reschedule();
});

globalThis.QF_LOCAL = {
  ready,
  native: reminders.native(),
  async request(method, url, body) {
    await ready;
    return api.request(method, url, body);
  },
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') dbmod.flush();
    else ready.then(() => reminders.reschedule());
  });
}
