// Те же маршруты, что у сервера, но внутри приложения: запрос -> маршрут -> ответ, без сети.
const express = require('express');

const app = express.Router();
app.use(require('../routes/profile'));
app.use(require('../routes/learn'));
app.use(require('../routes/plan'));
app.use(require('../routes/health'));
app.use(require('../routes/reports'));
app.use(require('../routes/notify'));

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const isFile = (v) => v && typeof v === 'object' && typeof v.size === 'number' && typeof v.type === 'string';

// body: объект или FormData (отчёт с фото и видео)
function request(method, rawUrl, body) {
  const u = new URL(rawUrl, 'http://local');
  const path = u.pathname.replace(/^\/api/, '') || '/';
  let fields = {};
  const files = {};
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    for (const [k, v] of body.entries()) { if (isFile(v)) files[k] = v; else fields[k] = v; }
  } else if (body !== undefined) fields = clone(body);
  const req = { method, path, query: Object.fromEntries(u.searchParams), params: {}, body: fields, files, headers: {}, ip: 'local' };
  return new Promise((resolve) => {
    let status = 200;
    const res = {
      setHeader() {},
      status(n) { status = n; return res; },
      json(data) { resolve({ status, data: clone(data) }); },
      end() { resolve({ status, data: null }); },
    };
    app.handle(req, res, (err) => {
      if (err) { console.error(err); resolve({ status: 500, data: { error: 'Что-то сломалось.' } }); } else resolve({ status: 404, data: { error: 'Такого адреса нет.' } });
    });
  });
}

module.exports = { request };
