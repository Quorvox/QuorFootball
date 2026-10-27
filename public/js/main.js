// Вход: проверяем профиль, рисуем меню, ведём по адресам вида #/plan.
import { get } from './api.js';
import { h, icon, toast } from './ui.js';

const app = document.getElementById('app');
const nav = document.getElementById('nav');

const TABS = [
  { path: '', label: 'Сегодня', icon: 'home' },
  { path: 'plan', label: 'План', icon: 'calendar' },
  { path: 'school', label: 'Школа', icon: 'book' },
  { path: 'food', label: 'Питание', icon: 'food' },
  { path: 'progress', label: 'Прогресс', icon: 'chart' },
  { path: 'more', label: 'Ещё', icon: 'more' },
];

// имя маршрута -> файл экрана; focus = без меню
const ROUTES = {
  '': { view: 'today' },
  plan: { view: 'plan' },
  library: { view: 'library' },
  reminders: { view: 'reminders' },
  school: { view: 'school' },
  lesson: { view: 'lesson' },
  food: { view: 'food' },
  progress: { view: 'progress' },
  more: { view: 'more' },
  workout: { view: 'workout' },
  run: { view: 'runner', focus: true },
  timer: { view: 'timer' },
  builder: { view: 'builder' },
  profile: { view: 'profile' },
  welcome: { view: 'onboarding', focus: true },
};

const ctx = {
  user: null,
  levels: [],
  leave: [],
  go(path) { location.hash = '#/' + path; },
  async loadUser() {
    try {
      const r = await get('/api/me');
      ctx.user = r.user;
      ctx.levels = r.levels;
    } catch (e) {
      if (e.status !== 401) throw e;
      ctx.user = null;
    }
    return ctx.user;
  },
  onLeave(fn) { ctx.leave.push(fn); },
};

function buildNav(active) {
  nav.replaceChildren(...TABS.map((t) =>
    h('a', { href: '#/' + t.path, 'aria-current': t.path === active ? 'page' : null }, icon(t.icon, 24), t.label)));
}

let token = 0;
async function route() {
  const my = ++token;
  ctx.leave.splice(0).forEach((fn) => { try { fn(); } catch { /* уходим */ } });
  const [name = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');

  if (!ctx.user && name !== 'welcome') {
    if (!(await ctx.loadUser())) return ctx.go('welcome');
  }
  if (ctx.user && name === 'welcome') return ctx.go('');

  const r = ROUTES[name] || ROUTES[''];
  const tab = TABS.some((t) => t.path === name) ? name : ['timer', 'builder', 'profile', 'reminders'].includes(name) ? 'more' : name === 'library' ? 'plan' : name === 'lesson' ? 'school' : name === 'workout' ? (params[0]?.startsWith('l-') ? 'school' : 'plan') : '';
  nav.hidden = !!r.focus;
  app.classList.toggle('bare', !!r.focus);
  if (!r.focus) buildNav(tab);

  try {
    const mod = await import(`./views/${r.view}.js`);
    const el = await mod.render({ ...ctx, params });
    if (my !== token) return;
    app.replaceChildren(el);
    window.scrollTo(0, 0);
  } catch (e) {
    if (my !== token) return;
    if (e.status === 401) { ctx.user = null; return ctx.go('welcome'); }
    app.replaceChildren(h('div', { class: 'panel stack tight' },
      h('h2', { text: 'Не получилось открыть экран' }),
      h('p', { text: e.message }),
      h('button', { class: 'btn primary', onclick: route, text: 'Попробовать ещё раз' })));
    toast(e.message, 'error');
  }
}

window.addEventListener('hashchange', route);
route();
