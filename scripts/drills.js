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
const boxEx = LIST.filter((e) => e.group === 'box');
ok(ball.length >= 55, `упражнений с мячом: ${ball.length}`);
ok(ball.every((e) => BALL_CATS.some((c) => c.key === e.cat)), 'у каждого упражнения с мячом есть раздел');
ok(ball.every((e) => ['tiny', 'small', 'big'].includes(e.space)), 'у каждого упражнения с мячом указано, сколько нужно места');
ok(ball.every((e) => e.steps.length >= 2 && e.tip.length > 10), 'у каждого есть подсказка и минимум два шага');
ok(BALL_CATS.every((c) => ball.some((e) => e.cat === c.key)), 'каждый раздел школы мяча не пустой');
ok(new Set(LIST.map((e) => e.key)).size === LIST.length, 'ключи упражнений не повторяются');

// все ключи в программе существуют
let broken = 0;
const levelsOf = (s) => (s.byStyle ? Object.values(s.byStyle).flatMap((st) => Object.values(st)) : Object.values(s.slots));
for (const s of Object.values(SESSIONS)) for (const lv of levelsOf(s)) for (const slot of lv) for (const k of slot) if (!LIB[k]) broken++;
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


// ---------- миграция старой базы ----------
{
  const { DatabaseSync } = require('node:sqlite');
  const { migrations } = require('../lib/schema');
  const old = new DatabaseSync(':memory:');
  old.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, token_hash TEXT, name TEXT, sex TEXT, age INTEGER, height INTEGER, weight REAL, level TEXT, goal TEXT, position TEXT, equipment TEXT NOT NULL DEFAULT '[]', dumbbell_kg REAL, remind_morning TEXT, remind_evening TEXT, tz TEXT, created_at TEXT)");
  old.exec("INSERT INTO users (id, token_hash, name) VALUES (1, 'x', 'Старый')");
  for (const sql of migrations(old.prepare('PRAGMA table_info(users)').all().map((c) => c.name))) old.exec(sql);
  const row = old.prepare('SELECT sport, box_style FROM users WHERE id = 1').get();
  ok(row.sport === 'football' && row.box_style === 'soviet', 'старая база получает колонки спорта и стиля, у старого профиля футбол');
  ok(migrations(old.prepare('PRAGMA table_info(users)').all().map((c) => c.name)).length === 0, 'повторная миграция ничего не делает');
}

// ---------- бокс ----------
const { BOX_CATS, COMBOS } = require('../data/boxing');
const { LESSONS } = require('../data/lessons');
ok(boxEx.length >= 30, `упражнений бокса: ${boxEx.length}`);
ok(boxEx.every((e) => BOX_CATS.some((c) => c.key === e.cat) && ['tiny', 'small', 'big'].includes(e.space)), 'у каждого упражнения бокса есть раздел и место');
ok(boxEx.every((e) => e.steps.length >= 2 && e.why && e.mistakes.length), 'у упражнений бокса есть шаги, «зачем» и ошибки');
ok(BOX_CATS.every((c) => boxEx.some((e) => e.cat === c.key)), 'каждый раздел школы бокса не пустой');
ok(boxEx.filter((e) => e.needs.includes('bag')).every((e) => e.needs.includes('gloves') && e.loud), 'мешок только с перчатками и не в тихом режиме');

const styles = ['soviet', 'american', 'mexican', 'cuban'];
const boxUser = (level, style, eq, sport = 'boxing') => ({ level, sport, box_style: style, equipment: JSON.stringify(eq), dumbbell_kg: 0, created_at: '2026-10-01 10:00:00' });
let enoughBox = true; let sigBox = true; let tinyBox = true;
const SIG = { soviet: 'box_distance', american: 'box_speed_hands', mexican: 'box_pressure_walk', cuban: 'box_angle_step' };
for (const st of styles) {
  for (const lv of ['novice', 'middle', 'pro']) {
    for (const code of ['BOX1', 'BOX2', 'BOX3', 'BOX4', 'BOX5', 'BOX6']) {
      for (const eq of [[], ['bag', 'gloves', 'rope'], ['rope', 'quiet'], ['tight']]) {
        const w = buildSession(boxUser(lv, st, eq), code, 1);
        const main = w.exercises.filter((e) => e.phase === 'main');
        if (main.length < 3) enoughBox = false;
        if (eq.includes('tight') && main.some((e) => e.space && e.space !== 'tiny')) tinyBox = false;
      }
    }
    if (!buildSession(boxUser(lv, st, []), 'BOX1', 1).exercises.some((e) => e.key === SIG[st])) sigBox = false;
  }
}
ok(enoughBox, 'бокс: в каждой тренировке у любого стиля, уровня и набора оборудования хватает упражнений');
ok(tinyBox, 'бокс: в тесном режиме только упражнения на месте');
ok(sigBox, 'у каждого стиля в тренировке есть своё фирменное упражнение');
const sets = styles.map((st) => buildSession(boxUser('middle', st, []), 'BOX2', 1).exercises.filter((e) => e.phase === 'main').map((e) => e.key).join());
ok(new Set(sets).size === 4, 'четыре стиля дают четыре разных набора упражнений');
ok(buildSession(boxUser('middle', 'mexican', ['bag', 'gloves']), 'BOX4', 1).exercises.some((e) => e.key === 'bag_body'), 'с мешком мексиканец бьёт по корпусу');
ok(!buildSession(boxUser('middle', 'mexican', []), 'BOX4', 1).exercises.some((e) => e.key.startsWith('bag_')), 'без мешка мешковых упражнений нет');
ok(buildSession(boxUser('middle', 'soviet', []), 'BOX4', 1).exercises.some((e) => e.key === 'box_shadow'), 'без мешка вместо него бой с тенью');

// выбор спорта меняет неделю
const week = (sport, eq = ['ball', 'rope']) => generated({ ...boxUser('middle', 'soviet', eq, sport), created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }).map((x) => x.code);
ok(week('football').every((c) => !c.startsWith('BOX')), 'футбол: бокса в неделе нет');
ok(week('boxing').filter((c) => c.startsWith('BOX')).length >= 4 && week('boxing').every((c) => !c.startsWith('BALL')), 'бокс: вечера боксёрские, мяча нет');
ok(week('both').some((c) => c.startsWith('BOX')) && week('both').some((c) => c.startsWith('BALL')), 'оба: в неделе и мяч, и бокс');

// голос тренера: серии под стиль и уровень, на бое с тенью они есть
const shadow = (st, lv) => buildSession(boxUser(lv, st, []), 'BOX1', 1).exercises.find((e) => e.key === 'box_shadow');
ok(styles.every((st) => ['novice', 'middle', 'pro'].every((lv) => shadow(st, lv).calls.length >= 5 && shadow(st, lv).calls.join() === COMBOS[st][lv].join())), 'на бое с тенью тренер называет серии по стилю и уровню');
ok(shadow('soviet', 'novice').callGap > shadow('soviet', 'pro').callGap, 'опытным серии говорят чаще');
ok(shadow('soviet', 'novice').sets === 2 && shadow('soviet', 'pro').sets === 4, 'раундов 2, 3 или 4 по уровню');

// уроки, фото, видео
const photosSrc = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'photos.js'), 'utf8');
const boxLessons = LESSONS.filter((l) => l.group === 'box');
ok(boxLessons.length >= 5 && boxLessons.every((l) => l.steps.length >= 4 && l.practice.every((k) => LIB[k])), `уроков бокса: ${boxLessons.length}, упражнения на месте`);
const photoNames = [...new Set(boxLessons.flatMap((l) => l.figs).filter((f) => f.startsWith('photo:')).concat(boxEx.map((e) => e.fig).filter((f) => f && f.startsWith('photo:'))).map((f) => f.slice(6)))];
ok(photoNames.length >= 5 && photoNames.every((n) => new RegExp(`'${n}': \\{`).test(photosSrc) && fs.readdirSync(path.join(__dirname, '..', 'public', 'img', 'photos')).some((f) => f.startsWith(n + '.'))), `фото бокса есть и в списке, и на диске: ${photoNames.join(', ')}`);
const ids = boxLessons.flatMap((l) => l.videos.map((v) => v.yt)).concat(boxEx.map((e) => e.video && e.video.yt).filter(Boolean));
ok(ids.length >= 5 && ids.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id)), `видео бокса: ${ids.length} ссылок нужного вида`);

console.log(fails ? `\nпровалено: ${fails}` : '\nвсё хорошо');
process.exit(fails ? 1 : 0);
