// Свободный таймер: обратный отсчёт, интервалы (работа/отдых) и секундомер.
import { h, icon, ring, beep, buzz, fmtClock, store } from '../ui.js';
import { pageHead } from '../components.js';

const MODES = [['down', 'Таймер'], ['interval', 'Интервалы'], ['watch', 'Секундомер']];

export async function render(ctx) {
  let mode = store.get('timer-mode', 'down');
  const root = h('div', { class: 'stack' });
  let stop = () => {};
  ctx.onLeave(() => stop());

  const body = h('div', { class: 'stack' });
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Режим' });

  function drawSeg() {
    seg.replaceChildren(...MODES.map(([k, label]) =>
      h('button', { type: 'button', 'aria-pressed': String(k === mode), text: label, onclick: () => { stop(); mode = k; store.set('timer-mode', k); drawSeg(); drawBody(); } })));
  }
  function drawBody() {
    body.replaceChildren(mode === 'down' ? countdown() : mode === 'interval' ? interval() : stopwatch());
  }

  // общий циферблат с кнопками
  function dial() {
    const r = ring({ size: 260, stroke: 12, accent: false });
    const time = h('div', { class: 'num', style: { fontSize: '72px', lineHeight: '1' }, text: '0:00' });
    const sub = h('div', { class: 'muted', text: ' ' });
    const el = h('div', { class: 'ring-wrap', style: { alignSelf: 'center' } }, r.el, h('div', { class: 'center' }, time, sub));
    return { el, r, time, sub };
  }

  // тикер: вызывает fn каждые 100 мс, пока не вызван stop
  function ticker(fn) {
    let last = performance.now();
    const id = setInterval(() => { const n = performance.now(); const dt = Math.min(1, (n - last) / 1000); last = n; fn(dt); }, 100);
    stop = () => clearInterval(id);
    return () => clearInterval(id);
  }

  function countdown() {
    const d = dial();
    let total = store.get('timer-secs', 60);
    let left = total;
    let off = () => {};
    let running = false;
    const input = h('input', { type: 'number', id: 't-secs', min: 5, max: 3600, inputmode: 'numeric', value: total, 'aria-label': 'Секунды' });
    const go = h('button', { class: 'btn primary big grow' });
    const draw = () => { d.time.textContent = fmtClock(Math.ceil(left)); d.r.set(total ? left / total : 0); };
    const label = () => go.replaceChildren(icon(running ? 'pause' : 'play', 22), running ? 'Пауза' : left < total && left > 0 ? 'Продолжить' : 'Старт');
    function setTotal(n) {
      off(); running = false;
      total = Math.max(5, Math.min(3600, Math.round(n) || 60));
      left = total; input.value = total; store.set('timer-secs', total); draw(); label();
    }
    go.onclick = () => {
      if (running) { off(); running = false; return label(); }
      if (left <= 0) left = total;
      running = true;
      off = ticker((dt) => {
        left -= dt;
        if (left <= 0) { left = 0; off(); running = false; beep(1100, 500); buzz([300, 100, 300]); label(); }
        draw();
      });
      label();
    };
    input.onchange = () => setTotal(Number(input.value));
    draw(); label();
    return h('div', { class: 'stack' }, d.el,
      h('div', { class: 'row wrap', style: { justifyContent: 'center' } },
        [15, 30, 45, 60, 90, 120].map((s) => h('button', { class: 'btn sm', type: 'button', onclick: () => setTotal(s), text: s >= 60 ? `${s / 60} мин` : `${s} сек` }))),
      h('div', { class: 'field' }, h('label', { for: 't-secs', text: 'Своё время, секунд' }), input),
      h('div', { class: 'row' }, go, h('button', { class: 'btn', onclick: () => setTotal(total), 'aria-label': 'Сбросить', text: 'Сброс' })));
  }

  function interval() {
    const saved = store.get('timer-int', { work: 30, rest: 15, rounds: 8 });
    const d = dial();
    const mk = (id, label, v, min, max) => h('div', { class: 'field' }, h('label', { for: id, text: label }), h('input', { type: 'number', id, min, max, inputmode: 'numeric', value: v }));
    const fWork = mk('i-work', 'Работа, сек', saved.work, 5, 600);
    const fRest = mk('i-rest', 'Отдых, сек', saved.rest, 0, 600);
    const fRounds = mk('i-rounds', 'Кругов', saved.rounds, 1, 50);
    const go = h('button', { class: 'btn primary big grow' });
    let off = () => {};
    let running = false;
    function start() {
      const num = (f, def, a, b) => Math.min(b, Math.max(a, Math.round(Number(f.querySelector('input').value)) || def));
      const work = num(fWork, 30, 5, 600);
      const rest = num(fRest, 15, 0, 600);
      const rounds = num(fRounds, 8, 1, 50);
      store.set('timer-int', { work, rest, rounds });
      let round = 1;
      let phase = 'work';
      let left = work;
      running = true;
      const draw = () => {
        d.time.textContent = fmtClock(Math.ceil(left));
        d.sub.textContent = `${phase === 'work' ? 'Работа' : 'Отдых'}, круг ${round} из ${rounds}`;
        d.r.set(left / (phase === 'work' ? work : rest));
      };
      beep(1040, 200);
      draw();
      off = ticker((dt) => {
        left -= dt;
        if (left <= 3 && left > 2.9) beep(700, 80);
        if (left <= 0) {
          if (phase === 'work' && rest > 0) { phase = 'rest'; left = rest; beep(520, 160); buzz(150); }
          else if (round < rounds) { round++; phase = 'work'; left = work; beep(1040, 220); buzz(150); }
          else { off(); running = false; d.time.textContent = '0:00'; d.sub.textContent = 'Готово'; beep(1200, 500); buzz([300, 100, 300]); label(); return; }
        }
        draw();
      });
      label();
    }
    const label = () => go.replaceChildren(icon(running ? 'x' : 'play', 22), running ? 'Стоп' : 'Старт');
    go.onclick = () => { if (running) { off(); running = false; label(); d.sub.textContent = ' '; } else start(); };
    d.time.textContent = fmtClock(saved.work);
    label();
    return h('div', { class: 'stack' }, d.el, h('div', { class: 'grid3' }, fWork, fRest, fRounds), h('div', { class: 'row' }, go),
      h('p', { class: 'hint', text: 'Подходит для бёрпи, прыжков, жонглирования: 30 сек работы, 15 отдыха, 8 кругов.' }));
  }

  function stopwatch() {
    const d = dial();
    let t = 0;
    let off = () => {};
    let running = false;
    const laps = h('ol', { class: 'list' });
    const go = h('button', { class: 'btn primary big grow' });
    const draw = () => { d.time.textContent = `${fmtClock(t)}`; d.sub.textContent = `.${String(Math.floor((t % 1) * 10))}`; d.r.set((t % 60) / 60); };
    const label = () => go.replaceChildren(icon(running ? 'pause' : 'play', 22), running ? 'Стоп' : t > 0 ? 'Продолжить' : 'Старт');
    go.onclick = () => {
      if (running) { off(); running = false; return label(); }
      running = true;
      off = ticker((dt) => { t += dt; draw(); });
      label();
    };
    const lap = h('button', { class: 'btn', text: 'Круг', onclick: () => { if (t > 0) laps.prepend(h('li', { class: 'row between' }, h('span', { class: 'muted', text: `Круг ${laps.children.length + 1}` }), h('span', { class: 'num', text: `${fmtClock(t)}.${Math.floor((t % 1) * 10)}` }))); } });
    const reset = h('button', { class: 'btn', text: 'Сброс', onclick: () => { off(); running = false; t = 0; laps.replaceChildren(); draw(); label(); } });
    draw(); label();
    return h('div', { class: 'stack' }, d.el, h('div', { class: 'row' }, go, lap, reset), laps);
  }

  root.append(pageHead('Таймер', 'Для отдыха между подходами и своих упражнений.'), seg, body);
  drawSeg();
  drawBody();
  return root;
}
