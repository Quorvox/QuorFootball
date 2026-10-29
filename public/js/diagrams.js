// Схемы упражнений сверху: ты, мяч, конусы, «соперник» и куда идёт мяч. Рисуются кодом, картинок не качаем.
import { svgEl } from './ui.js';

const W = 300;
const H = 170;

// маленькие кирпичики: ['me', x, y], ['ball', x, y], ['cone', x, y], ['foe', x, y], ['sq', x, y, w, h], ['wall', x1, y1, x2, y2],
// ['go', 'M...'] путь мяча, ['fake', 'M...'] обман или бросок, ['t', x, y, 'текст'], ['ring', x, y, r], ['chair', x, y, w, h]
const slalom = (n, x0, step, y = 85) => {
  const out = [];
  let d = `M${x0 - 36} ${y}`;
  for (let i = 0; i < n; i++) {
    const cx = x0 + i * step;
    out.push(['cone', cx, y]);
    const dy = i % 2 ? 24 : -24;
    d += ` Q${cx - step / 2 + 6} ${y - dy} ${cx} ${y + dy}`;
  }
  d += ` T${x0 + n * step - 6} ${y}`;
  return [['me', x0 - 44, y], ['ball', x0 - 28, y], ...out, ['go', d]];
};
const tinyFrame = [['sq', 95, 20, 110, 130], ['t', 150, 164, '1×1 м']];
const fakeLeft = (lbl1, lbl2) => [
  ['me', 140, 110], ['ball', 150, 90], ['foe', 205, 60],
  ['fake', 'M148 108 Q190 112 215 92'], ['t', 215, 142, lbl1],
  ['go', 'M150 88 Q120 70 80 60'], ['t', 55, 50, lbl2],
];

const SPEC = {
  // дриблинг и ведение
  cone_dribble: slalom(5, 80, 40),
  mini_slalom: slalom(3, 110, 38),
  cone_weave: slalom(5, 80, 40),
  triangle_dribble: [['cone', 150, 32], ['cone', 95, 120], ['cone', 205, 120], ['me', 150, 142], ['ball', 168, 128], ['go', 'M168 128 Q220 100 160 40 Q100 100 105 130 Q140 148 190 132']],
  figure8: [['cone', 105, 85], ['cone', 195, 85], ['me', 150, 142], ['ball', 150, 85], ['go', 'M150 85 C150 52 197 48 197 85 C197 122 150 118 150 85 C150 52 103 48 103 85 C103 122 150 118 150 85'], ['t', 150, 24, 'восьмёрка вокруг двух конусов']],
  box_dribble: [['sq', 75, 20, 150, 130], ['t', 150, 164, '2×2 м'], ['me', 150, 130], ['ball', 150, 108], ['go', 'M150 108 L112 76 L185 62 L170 118 L118 112']],
  l_turn: [['me', 60, 110], ['ball', 80, 110], ['go', 'M80 110 L180 110 L160 84 L225 54'], ['t', 180, 130, 'шаг вперёд'], ['t', 232, 40, 'уход вбок']],
  outside_push: [['me', 55, 110], ['ball', 75, 105], ['go', 'M75 105 Q140 90 200 70 T270 40'], ['t', 150, 140, 'внешней стороной стопы']],
  shield_dribble: [['me', 150, 95], ['ball', 112, 112], ['foe', 215, 85], ['go', 'M112 112 L50 128'], ['fake', 'M205 85 Q185 110 160 108'], ['t', 215, 66, 'соперник'], ['t', 95, 148, 'мяч дальше от него']],
  pace_change: [['me', 30, 90], ['ball', 48, 90], ['go', 'M48 90 L120 90'], ['fake', 'M120 90 L130 90'], ['go', 'M130 90 L270 90'], ['t', 85, 72, 'шагом'], ['t', 200, 72, 'рывок']],
  sprint_ball: [['me', 30, 90], ['ball', 48, 90], ['go', 'M48 90 L270 90'], ['t', 160, 72, '15-20 м']],
  weak_foot_dribble: [['me', 60, 100], ['ball', 82, 100], ['go', 'M82 100 Q150 80 220 100'], ['t', 150, 140, 'только слабой ногой']],
  dribble_turns: [['me', 60, 100], ['ball', 82, 100], ['go', 'M82 100 L190 100 Q215 100 215 80 Q215 60 190 60 L80 60'], ['t', 150, 130, 'разворот подошвой']],
  pull_back_turn: [['me', 130, 100], ['ball', 150, 80], ['go', 'M150 80 L150 115 L215 90'], ['t', 100, 140, 'подошвой назад, разворот']],

  // контроль, мелкие касания
  sole_roll: [...tinyFrame, ['me', 150, 52], ['ball', 150, 96], ['go', 'M150 96 L150 118 M150 96 L188 96']],
  sole_l: [...tinyFrame, ['me', 150, 52], ['ball', 150, 108], ['go', 'M150 108 L150 80 L188 80'], ['t', 205, 76, 'L']],
  drag_push: [...tinyFrame, ['me', 150, 50], ['ball', 150, 92], ['go', 'M150 92 L150 118'], ['go', 'M150 118 L186 100']],
  croqueta: [...tinyFrame, ['me', 150, 48], ['ball', 150, 98], ['go', 'M118 94 L182 94'], ['go', 'M182 104 L118 104']],
  clock_taps: [['ring', 150, 85, 26], ['t', 150, 52, '12'], ['t', 196, 90, '3'], ['t', 150, 132, '6'], ['t', 104, 90, '9'], ['ball', 150, 85], ['t', 150, 160, 'касайся подошвой по кругу']],
  futsal_box: [...tinyFrame, ['ball', 150, 85], ['go', 'M150 85 L120 62'], ['go', 'M150 85 L182 108'], ['go', 'M150 85 L176 58'], ['go', 'M150 85 L126 112']],
  sole_slide: [...tinyFrame, ['ball', 150, 90], ['go', 'M150 88 L186 88'], ['go', 'M186 98 L152 98']],
  pendulum: [...tinyFrame, ['ball', 150, 85], ['go', 'M112 85 L134 85'], ['go', 'M188 85 L166 85']],
  toe_taps: [...tinyFrame, ['ball', 150, 85], ['fake', 'M122 60 L142 78'], ['fake', 'M178 60 L158 78'], ['t', 150, 40, 'тап-тап']],
  inside_roll: [...tinyFrame, ['ball', 150, 85], ['go', 'M118 94 L182 94'], ['go', 'M182 78 L118 78']],
  v_pull: [...tinyFrame, ['ball', 150, 70], ['go', 'M150 70 L150 108 L188 80']],
  ball_switch: [['me', 150, 128], ['ball', 120, 100], ['go', 'M120 100 Q150 58 180 100'], ['go', 'M180 108 Q150 142 120 108'], ['t', 150, 24, 'мяч идёт дугой']],
  sole_spin: [...tinyFrame, ['me', 150, 52], ['ball', 150, 92], ['go', 'M150 92 Q184 84 176 118'], ['t', 150, 30, '90°']],
  accuracy_stop: [['sq', 112, 88, 76, 62], ['t', 150, 164, 'коврик 1×1 м'], ['ball', 150, 118], ['fake', 'M150 20 L150 100'], ['t', 200, 56, 'бросок руками']],
  first_touch_away: [['me', 150, 100], ['ball', 150, 78], ['foe', 222, 88], ['fake', 'M150 20 L150 70'], ['go', 'M150 78 Q110 88 66 104'], ['t', 238, 70, 'давление'], ['t', 66, 134, 'уходишь от него']],
  thigh_control: [['me', 150, 118], ['ball', 150, 60], ['fake', 'M150 18 L150 52'], ['go', 'M150 66 L150 100'], ['t', 214, 60, 'бедро как подушка']],
  knee_juggle: [['me', 150, 125], ['ball', 150, 68], ['go', 'M150 108 L150 80'], ['t', 215, 70, 'не выше пояса']],

  // финты
  scissors: [['me', 135, 110], ['ball', 150, 88], ['fake', 'M132 100 Q122 62 150 66 Q178 70 168 98'], ['go', 'M152 90 L215 90'], ['t', 150, 148, 'нога вокруг мяча сверху']],
  step_over: fakeLeft('обводишь ногой мяч', 'мяч уходит'),
  matthews: fakeLeft('качнул корпус', 'мяч внешней'),
  shoulder_fake: fakeLeft('плечо туда', 'мяч сюда'),
  cruyff: [['me', 150, 100], ['ball', 150, 72], ['foe', 85, 52], ['fake', 'M156 96 L124 70'], ['go', 'M150 72 C200 72 205 120 150 128'], ['t', 232, 64, 'замах'], ['t', 232, 150, 'мяч за ногу, разворот']],
  roulette: [['me', 140, 100], ['ball', 150, 85], ['go', 'M150 56 A30 30 0 1 1 149 56'], ['t', 150, 160, 'круг на 360° вокруг мяча']],
  elastico: [['me', 120, 105], ['ball', 150, 85], ['go', 'M150 85 L192 85'], ['go', 'M192 99 L132 99'], ['t', 150, 140, 'наружу и сразу внутрь']],

  // точность, пас, рондо
  gate_pass: [['me', 55, 85], ['ball', 75, 85], ['cone', 220, 70], ['cone', 220, 100], ['go', 'M75 85 L252 85'], ['t', 150, 66, '2-3 м'], ['t', 150, 140, 'ворота шириной в два мяча']],
  chair_pass: [['me', 55, 85], ['ball', 75, 85], ['chair', 205, 58, 55, 54], ['go', 'M75 85 L245 85'], ['t', 150, 150, 'пас под сиденье, ножки не задеть']],
  cushion_pass: [['me', 60, 85], ['ball', 80, 85], ['wall', 262, 40, 262, 130], ['go', 'M80 82 L252 82'], ['fake', 'M252 92 L84 92'], ['t', 150, 150, 'подушка у дивана']],
  tape_line: [['me', 45, 85], ['ball', 65, 85], ['wall', 85, 85, 265, 85], ['go', 'M65 84 L262 84'], ['t', 170, 118, 'мяч катится по линии']],
  wall_pass: [['me', 60, 85], ['ball', 80, 85], ['wall', 262, 30, 262, 140], ['go', 'M80 82 L252 82'], ['fake', 'M252 92 L84 92'], ['t', 150, 56, '2-4 м']],
  wall_rondo: [['me', 70, 85], ['ball', 90, 85], ['foe', 165, 85], ['wall', 262, 30, 262, 140], ['go', 'M90 70 Q165 40 252 70'], ['fake', 'M252 100 Q165 135 100 100'], ['t', 165, 152, '«защитник» посередине']],
  two_touch: [['me', 100, 95], ['ball', 120, 85], ['wall', 262, 30, 262, 140], ['go', 'M120 85 L252 85'], ['fake', 'M252 95 L130 95'], ['t', 100, 56, '1. приём'], ['t', 200, 140, '2. пас']],
  instep_wall: [['me', 60, 85], ['ball', 80, 85], ['wall', 262, 30, 262, 140], ['go', 'M80 85 L252 85'], ['t', 150, 56, 'шнуровкой, 3-5 м']],
  shoot_target: [['me', 40, 85], ['ball', 60, 85], ['cone', 268, 85], ['go', 'M60 85 L260 85'], ['t', 160, 66, '8-10 м'], ['t', 160, 140, 'цель: бутылка или квадрат']],

  // давление и осмотр поля
  pressure_clock: [['ring', 150, 85, 55], ['me', 150, 85], ['t', 150, 20, '12'], ['t', 232, 90, '3'], ['t', 150, 160, '6'], ['t', 68, 90, '9'], ['foe', 204, 85], ['ball', 118, 100], ['go', 'M118 100 L90 112'], ['fake', 'M204 70 Q180 38 150 34']],
  scan_touch: [['me', 150, 90], ['ball', 150, 112], ['t', 40, 32, '1'], ['t', 260, 32, '2'], ['t', 150, 162, '3'], ['fake', 'M140 82 L58 40'], ['fake', 'M160 82 L242 40'], ['fake', 'M150 112 L150 148'], ['t', 150, 14, 'взгляд через плечо, называй цифру']],
  blind_touch: [['me', 150, 100], ['ball', 150, 118], ['fake', 'M150 84 L150 34'], ['t', 150, 20, 'смотри вперёд, не на мяч']],
};

// синонимы: те же схемы, что у похожих упражнений
SPEC.inside_outside = SPEC.outside_push;
SPEC.juggle_alt = SPEC.knee_juggle;
SPEC.pressure_dribble = SPEC.pressure_clock;

const col = {
  me: 'var(--accent)', ball: '#f4f6f0', cone: 'var(--evening)', foe: 'var(--red)',
};

function drawItem(g, [type, ...a], uid) {
  const add = (tag, attrs, text) => { const e = svgEl(tag, attrs); if (text) e.textContent = text; g.append(e); return e; };
  switch (type) {
    case 'sq': add('rect', { x: a[0], y: a[1], width: a[2], height: a[3], rx: 8, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }); break;
    case 'ring': add('circle', { cx: a[0], cy: a[1], r: a[2], fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 1.5, 'stroke-dasharray': '4 4' }); break;
    case 'wall': add('line', { x1: a[0], y1: a[1], x2: a[2], y2: a[3], stroke: 'var(--ink-2)', 'stroke-width': 6, 'stroke-linecap': 'round' }); break;
    case 'chair':
      add('rect', { x: a[0], y: a[1], width: a[2], height: a[3], rx: 6, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2 });
      for (const [dx, dy] of [[4, 4], [a[2] - 4, 4], [4, a[3] - 4], [a[2] - 4, a[3] - 4]]) add('circle', { cx: a[0] + dx, cy: a[1] + dy, r: 4, fill: 'var(--ink-2)' });
      break;
    case 'cone': add('path', { d: `M${a[0]} ${a[1] - 9} L${a[0] + 8} ${a[1] + 7} L${a[0] - 8} ${a[1] + 7}Z`, fill: col.cone }); break;
    case 'foe':
      add('circle', { cx: a[0], cy: a[1], r: 11, fill: 'none', stroke: col.foe, 'stroke-width': 3 });
      add('path', { d: `M${a[0] - 5} ${a[1] - 5} L${a[0] + 5} ${a[1] + 5} M${a[0] + 5} ${a[1] - 5} L${a[0] - 5} ${a[1] + 5}`, stroke: col.foe, 'stroke-width': 3, 'stroke-linecap': 'round' });
      break;
    case 'me':
      add('circle', { cx: a[0], cy: a[1], r: 12, fill: col.me });
      add('text', { x: a[0], y: a[1] + 4.5, 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 700, fill: '#11190a' }, 'я');
      break;
    case 'ball': add('circle', { cx: a[0], cy: a[1], r: 6.5, fill: col.ball, stroke: '#222', 'stroke-width': 1.5 }); break;
    case 'go': add('path', { d: a[0], fill: 'none', stroke: 'var(--accent-text)', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'marker-end': `url(#arr-go-${uid})` }); break;
    case 'fake': add('path', { d: a[0], fill: 'none', stroke: 'var(--morning)', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-dasharray': '2 5', 'marker-end': `url(#arr-fake-${uid})` }); break;
    case 't': add('text', { x: a[0], y: a[1], 'text-anchor': 'middle', 'font-size': 11.5, 'font-weight': 600, fill: 'var(--ink-2)' }, a[2]); break;
    default: break;
  }
}

export const hasDiagram = (key) => Boolean(SPEC[key]);

// схема упражнения или null, если для него схемы нет
let counter = 0;
export function diagram(key, title) {
  const spec = SPEC[key];
  if (!spec) return null;
  const uid = ++counter;
  const uses = [...new Set(spec.map((it) => it[0]))];
  const s = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Схема: ${title || key}`, class: 'diagram' });
  s.dataset.uses = uses.join(',');
  const defs = svgEl('defs');
  for (const [id, color] of [['arr-go', 'var(--accent-text)'], ['arr-fake', 'var(--morning)']]) {
    const m = svgEl('marker', { id: `${id}-${uid}`, viewBox: '0 0 10 10', refX: 7, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' });
    m.append(svgEl('path', { d: 'M1 1 L9 5 L1 9Z', fill: color }));
    defs.append(m);
  }
  s.append(defs);
  // порядок слоёв: зоны, конусы и стены, потом пути, потом люди и мяч, потом подписи
  const order = { sq: 0, ring: 0, wall: 1, chair: 1, cone: 2, go: 3, fake: 3, foe: 4, me: 5, ball: 6, t: 7 };
  [...spec].sort((a, b) => order[a[0]] - order[b[0]]).forEach((it) => drawItem(s, it, uid));
  return s;
}
