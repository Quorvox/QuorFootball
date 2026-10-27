// Веб-часть приложения для Android: папка www = сайт + автономный слой (sql.js). Запуск: npm run build:app
const fs = require('fs');
const path = require('path');
const { bundle } = require('./bundle-local');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');

(async () => {
  fs.rmSync(www, { recursive: true, force: true });
  fs.cpSync(path.join(root, 'public'), www, {
    recursive: true,
    // сервис-воркер нужен только сайту с Web Push, в приложении уведомления ставит сам Android
    filter: (src) => path.basename(src) !== 'sw.js',
  });
  await bundle({ platform: 'browser', outfile: path.join(www, 'local-api.js'), minify: true });

  const file = path.join(www, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace('<script type="module" src="/js/main.js"></script>', '<script src="/local-api.js"></script>\n  <script type="module" src="/js/main.js"></script>');
  html = html.replace(/\s*<link rel="manifest"[^>]*>/, '');
  if (!html.includes('local-api.js')) throw new Error('не удалось подключить local-api.js в index.html');
  fs.writeFileSync(file, html);
  console.log('www собран:', fs.readdirSync(www).join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
