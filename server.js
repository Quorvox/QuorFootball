const express = require('express');
const path = require('path');

const app = express();
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 3100;

app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1');

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; " +
      "style-src 'self'; font-src 'self'; " +
      "frame-src https://www.youtube-nocookie.com; " +
      "script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
  );
  next();
});

app.use(express.json({ limit: '100kb' }));

app.use('/api', require('./routes/profile'));
app.use('/api', require('./routes/learn'));
app.use('/api', require('./routes/plan'));
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/reports'));
app.use('/api', require('./routes/notify'));

app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'ignore', etag: true, maxAge: 0 }));

app.use('/api', (req, res) => res.status(404).json({ error: 'Такого адреса нет.' }));

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Файл больше 150 МБ.' });
  if (err.message === 'BAD_TYPE') return res.status(400).json({ error: 'Фото: jpg, png, webp. Видео: mp4, webm, mov.' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Кривой запрос.' });
  if (err.name === 'MulterError') return res.status(400).json({ error: 'Не удалось принять файл.' });
  console.error(err);
  res.status(500).json({ error: 'Что-то сломалось на сервере.' });
});

require('./lib/push').start();
app.listen(PORT, HOST, () => console.log(`football-home: http://${HOST}:${PORT}`));
