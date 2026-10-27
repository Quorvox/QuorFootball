// Загрузки: имена генерим сами, оригинальное имя файла нигде не используем.
const path = require('path');
const fs = require('fs');

const uploadsDir = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const PHOTO_TYPES = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const VIDEO_TYPES = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };

function removeFiles(names) {
  for (const n of names) {
    if (!n || !/^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/.test(n)) continue;
    fs.rm(path.join(uploadsDir, n), { force: true }, () => {});
  }
}

module.exports = { uploadsDir, PHOTO_TYPES, VIDEO_TYPES, removeFiles };
