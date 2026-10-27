// Запросы к серверу. Ошибки приходят с понятным текстом от сервера.
// В приложении сервера нет: window.QF_LOCAL запускает те же маршруты прямо на телефоне
async function local(method, url, body) {
  const r = await globalThis.QF_LOCAL.request(method, url, body);
  if (r.status >= 400) {
    const e = new Error(r.data?.error || 'Что-то пошло не так.');
    e.status = r.status;
    throw e;
  }
  return r.data;
}

async function request(method, url, body) {
  if (globalThis.QF_LOCAL) return local(method, url, body);
  const opts = { method, headers: {} };
  if (body instanceof FormData) opts.body = body;
  else if (body !== undefined) {
    opts.headers['content-type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  let r;
  try {
    r = await fetch(url, opts);
  } catch {
    throw new Error('Нет связи с сервером. Проверь, что он запущен.');
  }
  let data = null;
  try { data = await r.json(); } catch { /* пустой ответ */ }
  if (!r.ok) {
    const e = new Error(data?.error || 'Что-то пошло не так.');
    e.status = r.status;
    throw e;
  }
  return data;
}

export const get = (url) => request('GET', url);
export const post = (url, body) => request('POST', url, body ?? {});
export const put = (url, body) => request('PUT', url, body ?? {});
export const del = (url) => request('DELETE', url);

// загрузка с процентами (fetch их не умеет)
export function upload(url, formData, onProgress) {
  if (globalThis.QF_LOCAL) return local('POST', url, formData).then((r) => { onProgress?.(1); return r; });
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.onerror = () => reject(new Error('Нет связи с сервером.'));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* не json */ }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      const e = new Error(data?.error || 'Не удалось загрузить.');
      e.status = xhr.status;
      reject(e);
    };
    xhr.send(formData);
  });
}
