// Хранилище на телефоне: база (байты sql.js) и файлы отчётов (фото, видео) в IndexedDB.
// Без IndexedDB (тесты в Node) всё лежит в памяти.
const hasIdb = typeof indexedDB !== 'undefined';
const mem = { db: new Map(), files: new Map() };

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('quorfootball', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('db'); r.result.createObjectStore('files'); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

let dbPromise;
const idb = () => (dbPromise = dbPromise || open());

async function tx(store, mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

module.exports = {
  get: (store, key) => (hasIdb ? tx(store, 'readonly', (s) => s.get(key)) : Promise.resolve(mem[store].get(key))),
  put: (store, key, value) => (hasIdb ? tx(store, 'readwrite', (s) => s.put(value, key)) : (mem[store].set(key, value), Promise.resolve())),
  del: (store, key) => (hasIdb ? tx(store, 'readwrite', (s) => s.delete(key)) : (mem[store].delete(key), Promise.resolve())),
};
