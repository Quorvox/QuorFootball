// Прогресс: серия, вес на графике, фото и видео отчёты.
import { get, post, del } from '../api.js';
import { h, icon, localDate, fmtDay, toast, plural } from '../ui.js';
import { pageHead, SLOT } from '../components.js';
import { lineChart } from '../chart.js';

const weightChart = (points) => lineChart(points.map((p) => ({ date: p.date, value: p.kg })), { unit: 'кг', decimals: 1, empty: 'Запиши вес хотя бы дважды, и здесь появится график.' });

export async function render(ctx) {
  const today = localDate();
  const [pr, rep] = await Promise.all([get('/api/progress?today=' + today), get('/api/reports')]);
  const root = h('div', { class: 'stack' }, pageHead('Прогресс', 'Серия, вес и твои отчёты.'));

  root.append(h('div', { class: 'stats' },
    h('div', { class: 'stat' }, h('div', { class: 'big', text: pr.streak }), h('div', { class: 'small muted', text: `${plural(pr.streak, ['день', 'дня', 'дней'])} подряд` })),
    h('div', { class: 'stat' }, h('div', { class: 'big', text: `${pr.week.done}/${pr.week.planned}` }), h('div', { class: 'small muted', text: 'на этой неделе' })),
    h('div', { class: 'stat' }, h('div', { class: 'big', text: pr.total }), h('div', { class: 'small muted', text: 'всего тренировок' }))));

  // вес
  const date = h('input', { type: 'date', id: 'w-date', value: today, max: today });
  const kg = h('input', { type: 'number', id: 'w-kg', min: 25, max: 250, step: '0.1', inputmode: 'decimal', placeholder: String(ctx.user.weight) });
  root.append(h('section', { class: 'panel stack' },
    h('h3', { text: 'Вес' }),
    weightChart(pr.weights),
    h('form', {
      class: 'row wrap', style: { alignItems: 'flex-end' }, onsubmit: async (e) => {
        e.preventDefault();
        try {
          await post('/api/weight', { date: date.value, kg: Number(String(kg.value).replace(',', '.')) });
          toast('Вес записан');
          ctx.user.weight = Number(kg.value);
          location.reload();
        } catch (ex) { toast(ex.message, 'error'); }
      },
    },
      h('div', { class: 'field grow' }, h('label', { for: 'w-date', text: 'Дата' }), date),
      h('div', { class: 'field grow' }, h('label', { for: 'w-kg', text: 'Вес, кг' }), kg),
      h('button', { class: 'btn primary', type: 'submit', text: 'Записать' })),
    h('p', { class: 'hint', text: 'Взвешивайся утром натощак раз в неделю. Питание пересчитается по последнему весу.' })));

  // рекорд чеканки
  const rec = await get('/api/records?kind=juggle');
  root.append(h('a', { class: 'panel row between', style: { textDecoration: 'none' }, href: '#/lesson/juggling' },
    h('div', null, h('h3', { text: 'Рекорд чеканки' }), h('p', { class: 'small muted', text: rec.items.length ? `Записей: ${rec.items.length}. Нажми, чтобы добавить результат.` : 'Ещё не записывал. Открой урок и поставь первый результат.' })),
    h('div', { class: 'num', style: { fontSize: '40px' }, text: rec.best })));

  // отчёты
  const grid = h('div', { class: 'reports' });
  const drawReports = (items) => {
    grid.replaceChildren(...items.map((r) => {
      const slot = SLOT[r.slot];
      const card = h('article', { class: 'report' },
        r.photo ? h('a', { href: r.photo, target: '_blank', rel: 'noopener' }, h('img', { src: r.photo, alt: `Фото: ${r.title}`, loading: 'lazy' })) : null,
        r.video ? h('video', { src: r.video, controls: true, preload: 'metadata', 'aria-label': `Видео: ${r.title}` }) : null,
        h('div', { class: 'meta' },
          h('div', { class: 'row between' }, h('b', { text: r.title }),
            h('button', { class: 'btn quiet sm', 'aria-label': 'Удалить отчёт', onclick: async () => {
              if (!confirm('Удалить отчёт вместе с фото и видео?')) return;
              try { await del('/api/reports/' + r.id); card.remove(); toast('Отчёт удалён'); } catch (ex) { toast(ex.message, 'error'); }
            } }, icon('trash', 18))),
          h('span', { class: 'small muted', text: `${fmtDay(r.date)}, ${slot.label.toLowerCase()}, ${Math.max(1, Math.round(r.durationSec / 60))} мин${r.rpe ? `, тяжесть ${r.rpe}/10` : ''}` }),
          r.note ? h('p', { class: 'small', text: r.note }) : null));
      return card;
    }));
  };
  drawReports(rep.items);
  root.append(h('section', { class: 'stack tight' },
    h('h2', { text: 'Отчёты' }),
    rep.items.length ? grid : h('div', { class: 'panel stack tight' }, h('p', { text: 'Отчётов пока нет. После тренировки сохрани отчёт с фото или видео, и он появится здесь.' }), h('a', { class: 'btn primary', href: '#/', text: 'К тренировке' })),
    rep.items.length ? h('p', { class: 'hint', text: `Занято ${rep.usedMb} МБ из 1024. Фото и видео видишь только ты.` }) : null));
  return root;
}
