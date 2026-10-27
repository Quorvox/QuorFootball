// Напоминания: время утром и вечером, включение уведомлений в браузере.
import { get, put, post } from '../api.js';
import { h, icon, toast } from '../ui.js';
import { backLink, pageHead } from '../components.js';

// в приложении уведомления ставит сам Android, в браузере это Web Push
const NATIVE = Boolean(globalThis.QF_LOCAL?.native);
const supported = NATIVE || ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);

const keyBytes = (b64) => {
  const raw = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

async function currentSub() {
  const reg = await navigator.serviceWorker.getRegistration('/');
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function render() {
  const s = await get('/api/reminders');
  const root = h('div', { class: 'stack' }, backLink('#/more', 'Ещё'), pageHead('Напоминания', 'Скажи, во сколько напомнить. Придёт уведомление, только если тренировка в это время ещё не сделана.'));

  const slotField = (id, label, value, fallback) => {
    const on = h('input', { type: 'checkbox', id: id + '-on', checked: Boolean(value) });
    const time = h('input', { type: 'time', id, value: value || fallback, 'aria-label': label });
    time.disabled = !value;
    on.addEventListener('change', () => { time.disabled = !on.checked; });
    return { get: () => (on.checked ? time.value || null : null), el: h('div', { class: 'row between panel' },
      h('label', { class: 'check', for: id + '-on' }, on, h('span', { class: 'name', text: label })), time) };
  };
  const morning = slotField('r-morning', 'Утренняя тренировка', s.morning, '08:00');
  const evening = slotField('r-evening', 'Вечерняя тренировка', s.evening, '19:00');
  const state = h('p', { class: 'small' });

  const save = async () => {
    try {
      await put('/api/reminders', { morning: morning.get(), evening: evening.get(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
      toast('Время сохранено');
    } catch (e) { toast(e.message, 'error'); }
  };

  async function refresh() {
    if (NATIVE) {
      const r = await get('/api/reminders');
      state.textContent = r.permission === 'granted' ? 'Уведомления включены. Они приходят в выбранное время, пока на этот день есть невыполненная тренировка.'
        : r.permission === 'denied' ? 'Android запретил уведомления для приложения. Разреши их в настройках телефона (Приложения, QuorFootball, Уведомления) и вернись сюда.'
          : 'Уведомления ещё не включены.';
      on.hidden = r.permission === 'granted' || r.permission === 'denied';
      test.hidden = r.permission !== 'granted';
      off.hidden = true;
      return;
    }
    if (!supported) { state.textContent = 'Этот браузер не умеет присылать уведомления. На iPhone добавь сайт на экран «Домой» (Поделиться, На экран «Домой») и открой его оттуда.'; return; }
    const sub = await currentSub();
    if (Notification.permission === 'denied') state.textContent = 'Уведомления для сайта запрещены в настройках браузера. Разреши их и вернись сюда.';
    else state.textContent = sub ? 'Уведомления на этом устройстве включены.' : 'Уведомления на этом устройстве выключены.';
    on.hidden = Boolean(sub);
    off.hidden = !sub;
    test.hidden = !sub;
  }

  const on = h('button', { class: 'btn primary big block', type: 'button', onclick: async () => {
    if (NATIVE) {
      try { await save(); await post('/api/reminders/enable'); } catch (e) { toast(e.message, 'error'); }
      return refresh();
    }
    try {
      if (await Notification.requestPermission() !== 'granted') return refresh();
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(s.publicKey) });
      const j = sub.toJSON();
      await save();
      await post('/api/push/subscribe', { endpoint: j.endpoint, keys: j.keys });
      toast('Уведомления включены');
    } catch (e) { toast(e.message || 'Не получилось включить уведомления', 'error'); }
    refresh();
  } }, icon('bell', 22), 'Включить уведомления');
  const off = h('button', { class: 'btn danger block', type: 'button', onclick: async () => {
    try {
      const sub = await currentSub();
      if (sub) { await post('/api/push/unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe(); }
      toast('Уведомления выключены');
    } catch (e) { toast(e.message, 'error'); }
    refresh();
  } }, 'Выключить на этом устройстве');
  const test = h('button', { class: 'btn block', type: 'button', onclick: async () => {
    try { await save(); await post(NATIVE ? '/api/reminders/test' : '/api/push/test'); toast(NATIVE ? 'Пробное придёт через 5 секунд' : 'Отправил пробное, проверь экран'); } catch (e) { toast(e.message, 'error'); }
  } }, 'Прислать пробное');

  root.append(morning.el, evening.el,
    h('button', { class: 'btn block', type: 'button', onclick: save }, 'Сохранить время'),
    h('section', { class: 'panel stack tight' }, h('h3', { text: 'Уведомления на этом устройстве' }), state, on, test, off),
    h('p', { class: 'hint', text: NATIVE ? 'Уведомления ставятся прямо на телефоне, интернет не нужен. Расписание обновляется, когда ты открываешь приложение, поэтому заглядывай хотя бы раз в пару недель.' : 'Уведомления приходят через сервис браузера (Google, Mozilla или Apple), на сайте они работают по HTTPS и на localhost. Сервер должен быть включён в нужное время. Часовой пояс берётся из браузера.' }));
  refresh();
  return root;
}
