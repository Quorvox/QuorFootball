// В приложении один человек и один профиль, пароль и куки не нужны.
const { db } = require('./db');

const findUser = () => db.prepare('SELECT * FROM users ORDER BY id LIMIT 1').get() || null;

function auth(req, res, next) {
  const user = findUser();
  if (!user) return res.status(401).json({ error: 'Профиль не найден. Создай его заново.' });
  req.user = user;
  next();
}

let n = 0;
module.exports = {
  auth,
  findUser,
  hash: (t) => t,
  newToken: () => `local-${Date.now()}-${n++}`,
  cookieHeader: () => '',
};
