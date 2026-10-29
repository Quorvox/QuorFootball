// Тренировка по шагам: таймер, отдых между подходами, звук, отчёт в конце.
import { get, upload } from '../api.js';
import { h, svgEl, icon, ring, beep, buzz, fmtClock, localDate, toast } from '../ui.js';
import { exerciseDetail, exerciseTags } from '../components.js';

const PHASE_LABEL = { warmup: 'Разминка', main: 'Основная часть', cooldown: 'Заминка' };
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE = 150 * 1024 * 1024;

function buildSteps(list) {
  const steps = [{ type: 'ready', secs: 5, name: 'Приготовься', tip: 'Встань так, чтобы хватало места. Рядом вода.', next: list[0]?.name }];
  list.forEach((e, i) => {
    for (let s = 1; s <= e.sets; s++) {
      steps.push({ type: 'work', name: e.name, tip: e.tip, data: e, load: e.load, phase: e.phase, set: s, sets: e.sets, ex: i, secs: e.kind === 'time' ? e.amount : null, reps: e.kind === 'reps' ? e.amount : null });
      const lastSet = s === e.sets;
      const lastEx = i === list.length - 1;
      if (lastSet && lastEx) continue;
      steps.push({
        type: 'rest', name: 'Отдых', tip: '', phase: e.phase, ex: i, secs: lastSet ? 10 : e.rest,
        next: lastSet ? list[i + 1].name : `${e.name}, подход ${s + 1} из ${e.sets}`,
      });
    }
  });
  return steps;
}

export async function render(ctx) {
  const w = await get('/api/workout/' + encodeURIComponent(ctx.params[0]));
  const steps = buildSteps(w.exercises);
  const exCount = w.exercises.length;

  let i = 0;
  let remaining = steps[0].secs;
  let paused = false;
  let finished = false;
  let elapsed = 0;
  let last = performance.now();
  let lastBeep = null;
  let wake = null;
  let urls = [];

  // каркас
  const phaseEl = h('span', { class: 'phase' });
  const counterEl = h('span', { class: 'phase' });
  const bars = Array.from({ length: exCount }, () => h('i'));
  const timeEl = h('div', { class: 'time' });
  const unitEl = h('div', { class: 'small muted' });
  const r = ring({ size: 320, stroke: 14, accent: true });
  const lines = svgEl('svg', { class: 'lines', viewBox: '0 0 376 376', 'aria-hidden': 'true' });
  lines.append(
    svgEl('circle', { cx: 188, cy: 188, r: 185, fill: 'none', stroke: '#333b40', 'stroke-width': 3 }),
    svgEl('path', { d: 'M0 188h20M356 188h20', stroke: '#333b40', 'stroke-width': 3 }));
  const nameEl = h('h2', { class: 'ex-name' });
  const subEl = h('p', { class: 'muted' });
  const tipEl = h('p', { class: 'tip' });
  const howEl = h('details', { class: 'how' }, h('summary', { text: 'Как делать' }));
  const howBody = h('div', { class: 'stack tight how-body' });
  howEl.append(howBody);
  const stage = h('div', { class: 'stage' },
    h('div', { class: 'pitch' }, lines, r.el, h('div', { class: 'center' }, timeEl, unitEl)),
    nameEl, subEl, tipEl, howEl);

  const pauseBtn = h('button', { class: 'btn', 'aria-label': 'Пауза', onclick: togglePause });
  const mainBtn = h('button', { class: 'btn primary big', onclick: () => advance() });
  const plusBtn = h('button', { class: 'btn', onclick: () => { remaining += 15; paint(); }, text: '+15 сек' });
  const controls = h('div', { class: 'controls' }, pauseBtn, mainBtn, plusBtn);

  const closeBtn = h('button', {
    class: 'btn quiet sm', 'aria-label': 'Выйти из тренировки', onclick: () => {
      if (finished || confirm('Прервать тренировку? Прогресс не сохранится.')) ctx.go('workout/' + w.ref);
    },
  }, icon('x', 18));

  const root = h('div', { class: 'runner', role: 'dialog', 'aria-label': w.title },
    h('div', { class: 'top' }, closeBtn, h('div', { class: 'grow' }, h('div', { class: 'num', style: { fontSize: '18px' }, text: w.title }), phaseEl), counterEl),
    h('div', { class: 'steps', 'aria-hidden': 'true' }, bars),
    stage, controls);

  function setPauseIcon() {
    pauseBtn.replaceChildren(icon(paused ? 'play' : 'pause', 22));
    pauseBtn.setAttribute('aria-label', paused ? 'Продолжить' : 'Пауза');
  }

  function paint() {
    const s = steps[i];
    stage.classList.toggle('rest', s.type === 'rest');
    phaseEl.textContent = s.type === 'ready' ? 'Старт' : PHASE_LABEL[s.phase] || '';
    counterEl.textContent = s.type === 'ready' ? '' : `${Math.min(s.ex + 1, exCount)} / ${exCount}`;
    bars.forEach((b, k) => b.classList.toggle('on', s.type !== 'ready' && k <= s.ex));
    nameEl.textContent = s.name;
    if (s.type === 'work') {
      const parts = [s.sets > 1 ? `Подход ${s.set} из ${s.sets}` : '', s.load || ''].filter(Boolean);
      subEl.textContent = parts.join(', ');
      tipEl.textContent = s.tip;
      howBody.replaceChildren(exerciseTags(s.data), exerciseDetail(s.data));
      howEl.hidden = !(s.data.steps?.length || s.data.key);
    } else {
      subEl.textContent = s.next ? `Дальше: ${s.next}` : '';
      tipEl.textContent = s.tip;
      howEl.hidden = true;
      howEl.open = false;
    }
    if (s.secs != null) {
      timeEl.classList.remove('reps');
      timeEl.textContent = fmtClock(Math.max(0, Math.ceil(remaining)));
      unitEl.textContent = '';
      r.set(remaining / s.secs);
    } else {
      timeEl.classList.add('reps');
      timeEl.textContent = s.reps;
      unitEl.textContent = 'повторов';
      r.set(1);
    }
    const reps = s.secs == null;
    mainBtn.replaceChildren(icon(reps ? 'check' : 'skip', 22), reps ? 'Готово' : 'Дальше');
    mainBtn.classList.toggle('primary', reps);
    plusBtn.hidden = s.type !== 'rest';
    setPauseIcon();
  }

  function enter() {
    const s = steps[i];
    remaining = s.secs ?? 0;
    lastBeep = null;
    // первый подход основной части: сразу показываем схему и шаги, чтобы не искать «Как делать»
    howEl.open = s.type === 'work' && s.set === 1 && s.phase === 'main';
    if (s.type === 'work') { beep(1040, 220); buzz(150); } else if (s.type === 'rest') { beep(520, 160); }
    paint();
  }

  function advance() {
    if (finished) return;
    i++;
    if (i >= steps.length) return finish();
    enter();
  }

  function togglePause() {
    paused = !paused;
    last = performance.now();
    setPauseIcon();
  }

  function tick() {
    const now = performance.now();
    const dt = Math.min(1, (now - last) / 1000);
    last = now;
    if (paused || finished) return;
    elapsed += dt;
    const s = steps[i];
    if (s.secs == null) return;
    remaining -= dt;
    const sec = Math.ceil(remaining);
    if (sec <= 3 && sec > 0 && sec !== lastBeep) { lastBeep = sec; beep(700, 80); }
    if (remaining <= 0) return advance();
    timeEl.textContent = fmtClock(sec);
    r.set(remaining / s.secs);
  }

  // отчёт после тренировки
  function finish() {
    finished = true;
    clearInterval(timer);
    beep(1200, 400); buzz([200, 100, 200]);
    const rpeLabels = ['', 'очень легко', 'легко', 'легко', 'нормально', 'нормально', 'тяжеловато', 'тяжело', 'тяжело', 'на пределе', 'на пределе'];
    const rpe = h('input', { type: 'range', id: 'r-rpe', name: 'rpe', min: 1, max: 10, step: 1, value: 6 });
    const rpeText = h('span', { class: 'num', style: { fontSize: '20px' }, text: `6, ${rpeLabels[6]}` });
    rpe.addEventListener('input', () => { rpeText.textContent = `${rpe.value}, ${rpeLabels[rpe.value]}`; });
    const note = h('textarea', { id: 'r-note', maxlength: 500, placeholder: 'Что получилось, что было тяжело' });
    const photo = h('input', { type: 'file', accept: PHOTO_TYPES.join(','), 'aria-label': 'Фото' });
    const video = h('input', { type: 'file', accept: VIDEO_TYPES.join(','), 'aria-label': 'Видео' });
    const prev = h('div');
    const prog = h('progress', { max: 1, value: 0, hidden: true });
    const err = h('p', { class: 'err', role: 'alert' });
    const save = h('button', { class: 'btn primary big block', type: 'submit', text: 'Сохранить отчёт' });

    const pick = (input, types, kind) => () => {
      const f = input.files[0];
      if (!f) return;
      if (!types.includes(f.type)) { input.value = ''; return void (err.textContent = kind === 'photo' ? 'Фото: jpg, png или webp.' : 'Видео: mp4, webm или mov.'); }
      if (f.size > MAX_FILE) { input.value = ''; return void (err.textContent = 'Файл больше 150 МБ.'); }
      err.textContent = '';
      const url = URL.createObjectURL(f);
      urls.push(url);
      prev.querySelector('.' + kind)?.remove();
      prev.append(kind === 'photo' ? h('img', { class: 'preview photo', src: url, alt: 'Твоё фото' }) : h('video', { class: 'preview video', src: url, controls: true, muted: true }));
    };
    photo.addEventListener('change', pick(photo, PHOTO_TYPES, 'photo'));
    video.addEventListener('change', pick(video, VIDEO_TYPES, 'video'));

    const form = h('form', {
      class: 'stack', onsubmit: async (e) => {
        e.preventDefault();
        save.disabled = true; err.textContent = ''; prog.hidden = false;
        const fd = new FormData();
        fd.append('date', localDate());
        fd.append('ref', w.ref);
        fd.append('durationSec', Math.round(elapsed));
        fd.append('rpe', rpe.value);
        fd.append('note', note.value);
        if (photo.files[0]) fd.append('photo', photo.files[0]);
        if (video.files[0]) fd.append('video', video.files[0]);
        try {
          await upload('/api/reports', fd, (p) => { prog.value = p; });
          toast('Отчёт сохранён');
          ctx.go('progress');
        } catch (ex) {
          err.textContent = ex.message;
          save.disabled = false; prog.hidden = true;
        }
      },
    },
      h('div', { class: 'stack tight' },
        h('h2', { text: 'Тренировка закончена' }),
        h('p', { class: 'muted', text: `Ты занимался ${Math.max(1, Math.round(elapsed / 60))} мин. Сохрани отчёт: он засчитает тренировку в плане.` })),
      h('div', { class: 'field' }, h('label', { for: 'r-rpe', text: 'Насколько было тяжело' }), rpe, rpeText),
      h('div', { class: 'field' }, h('label', { for: 'r-note', text: 'Заметка' }), note),
      h('div', { class: 'stack tight' },
        h('span', { class: 'label', text: 'Фото и видео отчёт (по желанию)' }),
        h('div', { class: 'grid2' },
          h('div', { class: 'btn file-btn' }, icon('camera', 20), 'Фото', photo),
          h('div', { class: 'btn file-btn' }, icon('video', 20), 'Видео', video)),
        prev),
      prog, err, save,
      h('button', { class: 'linkish muted', type: 'button', text: 'Не сохранять и выйти', onclick: () => { if (confirm('Тренировка не засчитается. Выйти?')) ctx.go(''); } }));
    stage.replaceWith(form);
    controls.remove();
    root.querySelector('.steps').remove();
    root.querySelector('.top .grow').lastChild.textContent = 'Готово';
    counterEl.textContent = '';
  }

  // не даём экрану гаснуть
  async function lock() {
    try { wake = await navigator.wakeLock?.request('screen'); } catch { /* не поддерживается */ }
  }
  const onVisible = () => { if (document.visibilityState === 'visible' && !finished) lock(); };
  const onKey = (e) => {
    if (finished || e.target.closest?.('input, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.code === 'Enter' || e.code === 'ArrowRight') { e.preventDefault(); advance(); }
  };
  document.addEventListener('visibilitychange', onVisible);
  document.addEventListener('keydown', onKey);
  lock();

  const timer = setInterval(tick, 100);
  ctx.onLeave(() => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('keydown', onKey);
    try { wake?.release(); } catch { /* уже отпущен */ }
    urls.forEach((u) => URL.revokeObjectURL(u));
    root.remove();
  });

  enter();
  return root;
}
