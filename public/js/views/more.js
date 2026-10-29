// Ещё: таймер, своя тренировка, профиль, данные и приватность.
import { del } from '../api.js';
import { h, icon, toast } from '../ui.js';
import { pageHead } from '../components.js';

const LINKS = [
  ['#/drills', 'ball', 'Школа мяча', 'Дриблинг, контроль, финты, футзал: все упражнения'],
  ['#/library', 'list', 'Все тренировки', 'По группам: сила, скорость, мяч, восстановление'],
  ['#/reminders', 'bell', 'Напоминания', 'Во сколько напомнить про утро и вечер'],
  ['#/timer', 'clock', 'Таймер', 'Отсчёт, интервалы, секундомер'],
  ['#/builder', 'dumbbell', 'Своя тренировка', 'Собери из базы упражнений'],
  ['#/profile', 'user', 'Профиль и оборудование', 'Уровень, что у тебя есть, вес, цель'],
];

export async function render(ctx) {
  const root = h('div', { class: 'stack' }, pageHead('Ещё'));
  root.append(h('nav', { class: 'stack tight', 'aria-label': 'Дополнительно' }, LINKS.map(([href, ic, title, text]) =>
    h('a', { class: 'session', style: { gridTemplateColumns: '56px 1fr auto' }, href },
      h('span', { class: 'row', style: { justifyContent: 'center' } }, icon(ic, 26)),
      h('div', { class: 'body' }, h('div', { class: 'title', text: title }), h('div', { class: 'small muted', text })),
      h('div', { class: 'go' }, icon('next', 24))))));

  root.append(h('section', { class: 'panel stack tight' },
    h('h3', { text: 'Твои данные' }),
    h('p', { class: 'small', text: globalThis.QF_LOCAL ? 'Всё, что ты вводишь (профиль, вес, воду, отчёты, фото и видео), хранится только на этом телефоне. Приложение ничего никуда не отправляет, аккаунта и пароля нет. Если удалить приложение или его данные, всё пропадёт.' : 'Всё, что ты вводишь (профиль, вес, воду, отчёты, фото и видео), хранится на этом сервере и привязано к этому браузеру. Другим людям оно не показывается. Пароля нет: вход держится на ключе в браузере, поэтому в другом браузере профиль придётся создать заново.' }),
    h('p', { class: 'small', text: 'Расчёты питания и воды примерные и не заменяют врача. Больно резко или плохо себя чувствуешь, останови тренировку.' }),
    h('p', { class: 'small' }, h('a', { href: '/privacy.html', text: 'Подробнее о приватности' })),
    h('button', {
      class: 'btn danger', onclick: async () => {
        if (!confirm('Удалить профиль, историю и все фото и видео? Это нельзя отменить.')) return;
        try { await del('/api/me'); ctx.user = null; toast('Все данные удалены'); location.hash = '#/welcome'; location.reload(); } catch (e) { toast(e.message, 'error'); }
      },
    }, icon('trash', 18), 'Удалить все мои данные')));
  return root;
}
