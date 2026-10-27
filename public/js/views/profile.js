// Настройки профиля: уровень, оборудование, цель, позиция и данные тела.
import { get, put } from '../api.js';
import { h, toast } from '../ui.js';
import { pageHead, backLink } from '../components.js';
import { levelChoice, bodyFields, equipmentFields, goalChoice, positionChoice, readProfile } from '../forms.js';

export async function render(ctx) {
  const u = ctx.user;
  const catalog = await get('/api/catalog');
  const err = h('p', { class: 'err', role: 'alert' });
  const save = h('button', { class: 'btn primary big block', type: 'submit', text: 'Сохранить' });
  const form = h('form', {
    class: 'stack', novalidate: true, onsubmit: async (e) => {
      e.preventDefault();
      err.textContent = '';
      save.disabled = true;
      try {
        await put('/api/me', readProfile(form));
        await ctx.loadUser();
        toast('Профиль сохранён');
        ctx.go('plan');
      } catch (ex) { err.textContent = ex.message; save.disabled = false; }
    },
  },
    h('section', { class: 'stack tight' }, h('h3', { text: 'Уровень' }), levelChoice(u.level)),
    h('section', { class: 'stack tight' }, h('h3', { text: 'Оборудование' }), equipmentFields(catalog.equipment, u)),
    h('section', { class: 'stack tight' }, h('h3', { text: 'Данные' }), bodyFields(u)),
    h('section', { class: 'stack tight' }, h('h3', { text: 'Цель' }), goalChoice(u.goal)),
    h('section', { class: 'stack tight' }, h('h3', { text: 'Позиция' }), positionChoice(u.position)),
    err, save);
  return h('div', { class: 'stack' }, backLink('#/more', 'Ещё'), pageHead('Профиль', 'Поменяешь уровень или оборудование, и план недели перестроится. Отчёты останутся.'), form);
}
