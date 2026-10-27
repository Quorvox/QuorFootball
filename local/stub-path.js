// Заглушка модуля path для приложения.
const join = (...parts) => parts.join('/').replace(/\/+/g, '/');
module.exports = { join, resolve: join, dirname: (p) => p.replace(/\/[^/]*$/, '') };
