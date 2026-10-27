// Профиль без пароля: случайный токен в httpOnly-куке, в базе только его хэш.
const crypto = require('crypto');
const { db } = require('../db');

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function findUser(req) {
  const token = parseCookies(req.headers.cookie).ft;
  return (token && db.prepare('SELECT * FROM users WHERE token_hash = ?').get(hash(token))) || null;
}

function auth(req, res, next) {
  const user = findUser(req);
  if (!user) return res.status(401).json({ error: 'Профиль не найден. Создай его заново.' });
  req.user = user;
  next();
}

function newToken() {
  return crypto.randomBytes(32).toString('hex');
}

function cookieHeader(token, maxAge = 31536000) {
  const secure = process.env.COOKIE_SECURE === '1' ? '; Secure' : '';
  return `ft=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

module.exports = { auth, findUser, hash, newToken, cookieHeader };
