// В приложении файловой системы Node нет: маршруты, которые её зовут, получают пустые заглушки.
module.exports = {
  readdirSync: () => [],
  mkdirSync: () => {},
  existsSync: () => false,
  rm: () => {},
};
