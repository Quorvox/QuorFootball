// Файлы отчётов в приложении лежат в IndexedDB, имена и типы те же, что на сервере.
const storage = require('./storage');

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const urls = new Map();

function removeFiles(names) {
  for (const n of names) {
    if (!n) continue;
    storage.del('files', n).catch(() => {});
    const u = urls.get(n);
    if (u) { try { URL.revokeObjectURL(u); } catch { /* уже нет */ } urls.delete(n); }
  }
}

// ссылка на сохранённый файл для <img> и <video>
async function fileUrl(name) {
  if (!name) return null;
  if (urls.has(name)) return urls.get(name);
  const blob = await storage.get('files', name);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(name, u);
  return u;
}

module.exports = { uploadsDir: '', PHOTO_TYPES, VIDEO_TYPES, removeFiles, fileUrl };
