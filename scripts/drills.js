// Проверка упражнений с мячом и режима «тесно 1×1 м»: node scripts/drills.js
const fs = require('fs');
const path = require('path');
const { LIST, LIB, BALL_CATS } = require('../data/library');
const { SESSIONS } = require('../data/program');
const { buildSession, generated } = require('../lib/build');

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? 'ok   ' : 'FAIL ') + msg); if (!cond) fails++; };
const user = (level, equipment, created = '2026-10-01 10:00:00') => ({ level, equipment: JSON.stringify(equipment), dumbbell_kg: 0, created_at: created });

const ball = LIST.filter((e) => e.group === 'ball');
ok(ball.length >= 55, `упражнений с мячом: ${ball.length}`);
ok(ball.every((e) => BALL_CATS.some((c) => c.key === e.cat)), 'у каждого упражнения с мячом есть раздел');
ok(ball.every((e) => ['tiny', 'small', 'big'].includes(e.space)), 'у каждого упражнения с мячом указано, сколько нужно места');
ok(ball.every((e) => e.steps.length >= 2 && e.tip.length > 10), 'у каждого есть подсказка и минимум два шага');
ok(BALL_CATS.every((c) => ball.some((e) => e.cat === c.key)), 'каждый раздел школы мяча не пустой');
ok(new Set(LIST.map((e) => e.key)).size === LIST.length, 'ключи упражнений не повторяются');

// все ключи в программе существуют
let broken = 0;
for (const s of Object.values(SESSIONS)) for (const lv of Object.values(s.slots)) for (const slot of lv) for (const k of slot) if (!LIB[k]) broken++;
ok(broken === 0, 'в программе нет ссылок на несуществующие упражнения');

// схемы: у каждого ключа в схемах есть упражнение, а у ключевых новых упражнений схема есть
const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'diagrams.js'), 'utf8');
const specBlock = src.slice(src.indexOf('const SPEC = {'), src.indexOf('// синонимы'));
const specKeys = [...specBlock.matchAll(/^ {2}([a-z_0-9]+): /gm)].map((m) => m[1]);
ok(specKeys.length >= 40, `схем упражнений: ${specKeys.length}`);
ok(specKeys.every((k) => LIB[k]), 'каждая схема относится к существующему упражнению');
const must = ['sole_l', 'drag_push', 'croqueta', 'clock_taps', 'futsal_box', 'step_over', 'matthews', 'roulette', 'elastico', 'shield_dribble', 'first_touch_away', 'pressure_clock', 'scan_touch', 'mini_slalom', 'cone_dribble', 'gate_pass'];
ok(must.every((k) => specKeys.includes(k)), 'у главных упражнений есть схема');

// режим «тесно»: на каждом уровне все упражнения с мячом помещаются на 1×1 м и в тренировке хватает упражнений
for (const lv of ['novice', 'middle', 'pro']) {
  const u = user(lv, ['ball', 'quiet', 'tight']);
  let tiny = true; let enough = true;
  for (const code of Object.keys(SESSIONS).filter((c) => c.startsWith('BALL'))) {
    const w = buildSession(u, code, 1);
    const main = w.exercises.filter((e) => e.phase === 'main');
    if (main.some((e) => e.space && e.space !== 'tiny')) tiny = false;
    if (main.length < 3) enough = false;
  }
  ok(tiny, `${lv}: тесно, значит только упражнения на месте`);
  ok(enough, `${lv}: тесно, но в каждой мячевой тренировке есть хотя бы 3 упражнения`);
}

// обычный профиль получает дриблинг, финты и контроль
const names = (u, code) => buildSession(u, code, 1).exercises.filter((e) => e.phase === 'main').map((e) => e.key);
ok(names(user('middle', ['ball', 'cones']), 'BALL3').includes('cone_dribble'), 'с конусами есть слалом');
ok(!names(user('middle', ['ball']), 'BALL3').includes('cone_dribble'), 'без конусов слалома нет');
ok(names(user('pro', ['ball']), 'BALL6').some((k) => ['roulette', 'elastico'].includes(k)), 'у опытных в финтах есть рулетка или эластико');
ok(names(user('novice', ['ball']), 'BALL6').every((k) => !['roulette', 'elastico'].includes(k)), 'новичкам рулетка и эластико не даются');
ok(buildSession(user('middle', ['ball']), 'BALL8', 1).exercises.some((e) => e.pressure), 'в игре под давлением есть подсказки про «соперника»');

// мячевые тренировки по неделям меняют упражнения
const days = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 19).replace('T', ' ');
const weekSets = [0, 7, 14].map((d) => generated(user('middle', ['ball', 'cones', 'chair'], days(d))).filter((x) => x.code.startsWith('BALL')).flatMap((x) => x.exercises.map((e) => e.key)).sort().join());
ok(new Set(weekSets).size === 3, 'три недели подряд мяч с разными упражнениями');
ok(generated(user('middle', ['ball'], days(0))).every((x) => !/вариант/.test(x.title)), 'в названиях плана нет «вариант 2»');

console.log(fails ? `\nпровалено: ${fails}` : '\nвсё хорошо');
process.exit(fails ? 1 : 0);
