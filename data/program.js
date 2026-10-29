// Программа. Слот = список вариантов по приоритету: берётся первый, который подходит под оборудование
// и не повторяется в этой тренировке. Последний вариант в слоте всегда без оборудования.
const L = (novice, middle, pro) => ({ novice, middle, pro });
const one = (...keys) => keys.map((k) => [k]);

const SESSIONS = {
  LEGS: {
    group: 'strength',
    title: 'Ноги и сила',
    focus: 'Сила ног, взрывной старт, пресс в конце',
    slots: L(
      [['goblet_squat', 'split_squat', 'squat'], ['lunge'], ['glute_bridge'], ['calf_raise'], ['wall_sit'], ['crunch', 'dead_bug']],
      [['goblet_squat', 'squat'], ['db_lunge', 'lunge'], ['db_rdl', 'glute_bridge'], ['nordic'], ['calf_raise'], ['jump_squat', 'cossack'], ['wall_sit'], ['leg_raise', 'crunch']],
      [['bulgarian', 'goblet_squat', 'squat'], ['db_lunge', 'side_lunge', 'lunge'], ['db_rdl', 'sl_rdl'], ['nordic'], ['sl_bridge', 'glute_bridge'], ['jump_squat', 'broad_jump', 'cossack'], ['calf_raise'], ['hanging_knee_raise', 'leg_raise']]
    ),
  },
  UPPER: {
    group: 'strength',
    title: 'Верх тела: отжимания и подтягивания',
    focus: 'Грудь, спина, руки и пресс',
    slots: L(
      [['incline_pushups', 'knee_pushups', 'wall_pushups'], ['neg_pullups', 'db_row', 'band_row', 'superman'], ['bench_dips', 'wall_pushups'], ['band_pull_apart', 'ytw', 'superman'], ['crunch', 'dead_bug']],
      [['pushups', 'knee_pushups'], ['pullups', 'chinups', 'db_row', 'band_row', 'superman'], ['dips', 'bench_dips', 'wide_pushups'], ['db_row', 'band_row', 'ytw', 'superman'], ['db_shoulder_press', 'pike_pushups'], ['leg_raise', 'bicycle']],
      [['decline_pushups', 'diamond_pushups', 'pushups'], ['chinups', 'pullups', 'db_row', 'band_row', 'superman'], ['dips', 'diamond_pushups', 'bench_dips', 'pike_pushups'], ['band_pullups', 'db_row', 'band_row', 'ytw'], ['db_shoulder_press', 'pike_pushups'], ['db_curl', 'superman'], ['hanging_leg_raise', 'hollow_hold']]
    ),
  },
  CORE: {
    group: 'strength',
    title: 'Пресс и кор',
    focus: 'Корпус, стабильность, профилактика травм',
    slots: L(
      [['plank'], ['dead_bug'], ['crunch'], ['side_plank'], ['superman']],
      [['plank'], ['side_plank', 'copenhagen'], ['dead_bug', 'v_ups'], ['leg_raise', 'reverse_crunch'], ['russian_twist', 'bicycle'], ['mountain'], ['superman']],
      [['plank'], ['copenhagen', 'side_plank'], ['hanging_leg_raise', 'v_ups'], ['hollow_hold'], ['russian_twist', 'bicycle'], ['mountain'], ['flutter']]
    ),
  },
  SPEED: {
    group: 'speed',
    outdoor: true,
    title: 'Скорость и ловкость',
    focus: 'Скорость, смена направления, выносливость',
    slots: L(
      [['jump_rope', 'high_knees', 'quiet_steps'], ['shuffle'], ['skater', 'quiet_skater'], ['fast_feet', 'box_steps'], ['star_jumps', 'tape_ladder']],
      [['jump_rope', 'high_knees', 'quiet_steps'], ['shuffle'], ['skater', 'quiet_skater'], ['cone_weave', 'tape_ladder', 'fast_feet'], ['star_jumps', 'box_steps'], ['burpees', 'sprint_20', 'mountain']],
      [['jump_rope', 'high_knees', 'quiet_steps'], ['shuffle'], ['skater', 'quiet_skater'], ['shuttle_run', 'cone_weave', 'tape_ladder', 'fast_feet'], ['broad_jump', 'sprint_20', 'star_jumps', 'box_steps'], ['burpees', 'mountain']]
    ),
  },
  BALL1: {
    group: 'ball',
    outdoor: true,
    title: 'Мяч: чеканка и контроль',
    focus: 'Чеканка, первое касание, чувство мяча',
    slots: L(
      [['juggle_catch', 'juggle'], ['toe_taps', 'clock_taps'], ['inside_roll', 'pendulum'], ['sole_roll', 'sole_l'], ['drag_push', 'v_pull']],
      [['juggle_alt', 'juggle', 'knee_juggle'], ['toe_taps', 'clock_taps'], ['inside_roll', 'croqueta', 'drag_push'], ['v_pull', 'sole_l', 'sole_slide'], ['thigh_control', 'first_touch_away']],
      [['juggle_thigh', 'juggle_alt', 'knee_juggle'], ['juggle_weak', 'low_juggle'], ['croqueta', 'drag_push', 'v_pull'], ['sole_l', 'clock_taps', 'sole_roll'], ['first_touch_away', 'thigh_control', 'accuracy_stop']]
    ),
  },
  BALL2: {
    group: 'ball',
    outdoor: true,
    title: 'Мяч: удар и пас',
    focus: 'Пас внутренней стороной, удар подъёмом, приём',
    slots: L(
      [['wall_pass', 'gate_pass', 'tape_line', 'inside_roll'], ['first_touch_wall', 'accuracy_stop', 'thigh_control', 'sole_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'cushion_pass', 'v_pull'], ['dribble_turns', 'pendulum']],
      [['wall_pass', 'gate_pass', 'cushion_pass', 'inside_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'v_pull'], ['first_touch_wall', 'first_touch_away', 'accuracy_stop', 'sole_roll'], ['wall_rondo', 'two_touch', 'dribble_turns', 'box_dribble'], ['weak_foot_dribble']],
      [['wall_rondo', 'wall_pass', 'gate_pass', 'inside_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'v_pull'], ['two_touch', 'first_touch_wall', 'first_touch_away', 'sole_roll'], ['juggle_weak', 'low_juggle'], ['weak_foot_dribble']]
    ),
  },
  BALL3: {
    group: 'ball',
    outdoor: true,
    title: 'Мяч: ведение и слабая нога',
    focus: 'Ведение, развороты, работа слабой ногой',
    slots: L(
      [['figure8', 'box_dribble', 'l_turn'], ['inside_outside', 'outside_push', 'pendulum'], ['dribble_turns', 'pull_back_turn'], ['weak_foot_dribble']],
      [['cone_dribble', 'mini_slalom', 'box_dribble', 'figure8'], ['inside_outside', 'outside_push', 'pendulum'], ['cruyff', 'step_over', 'scissors', 'dribble_turns'], ['weak_foot_dribble'], ['shield_dribble', 'blind_touch', 'juggle_weak']],
      [['cone_dribble', 'mini_slalom', 'triangle_dribble', 'figure8'], ['inside_outside', 'outside_push', 'pendulum'], ['cruyff', 'matthews', 'step_over', 'scissors'], ['pull_back_turn', 'l_turn', 'dribble_turns'], ['weak_foot_dribble'], ['shield_dribble', 'blind_touch', 'juggle_weak']]
    ),
  },
  // дальше тренировки только из каталога: в расписание недели не входят, делай в любой день
  BALL4: {
    group: 'ball',
    title: 'Контроль: первое касание',
    focus: 'Приём мяча стопой, бедром и подошвой, уход от «соперника»',
    slots: L(
      [['accuracy_stop', 'thigh_control'], ['sole_roll', 'sole_spin'], ['first_touch_away', 'first_touch_wall', 'inside_roll'], ['juggle_catch', 'knee_juggle'], ['drag_push', 'v_pull']],
      [['accuracy_stop', 'thigh_control'], ['sole_spin', 'sole_roll'], ['first_touch_away', 'first_touch_wall'], ['knee_juggle', 'juggle_alt', 'juggle'], ['drag_push', 'croqueta'], ['two_touch', 'cushion_pass', 'inside_roll']],
      [['thigh_control', 'accuracy_stop'], ['sole_spin', 'sole_roll'], ['first_touch_away', 'first_touch_wall'], ['juggle_thigh', 'knee_juggle', 'juggle_alt'], ['croqueta', 'drag_push'], ['two_touch', 'cushion_pass', 'inside_roll']]
    ),
  },
  BALL5: {
    group: 'ball',
    title: 'Дриблинг по методу Кёрвера',
    focus: 'Мелкие касания обеими ногами, смена направления, мяч не отпускаешь',
    slots: L(
      [['toe_taps', 'clock_taps'], ['drag_push', 'v_pull'], ['inside_outside', 'ball_switch', 'pendulum'], ['l_turn', 'triangle_dribble', 'figure8'], ['outside_push', 'weak_foot_dribble']],
      [['toe_taps', 'clock_taps'], ['drag_push', 'v_pull', 'croqueta'], ['inside_outside', 'ball_switch'], ['l_turn', 'triangle_dribble', 'figure8'], ['outside_push', 'pull_back_turn'], ['weak_foot_dribble']],
      [['clock_taps', 'toe_taps'], ['croqueta', 'drag_push'], ['ball_switch', 'inside_outside'], ['triangle_dribble', 'l_turn', 'figure8'], ['outside_push', 'pull_back_turn'], ['weak_foot_dribble'], ['pace_change', 'sprint_ball', 'shield_dribble']]
    ),
  },
  BALL6: {
    group: 'ball',
    title: 'Финты: обмани соперника',
    focus: 'Накладка, Мэттьюз, Кройф, рулетка: корпус говорит одно, мяч уходит в другое',
    slots: L(
      [['scissors', 'pull_back_turn'], ['cruyff', 'dribble_turns'], ['shoulder_fake', 'l_turn'], ['step_over', 'figure8']],
      [['scissors', 'step_over'], ['cruyff', 'matthews'], ['shoulder_fake', 'l_turn'], ['step_over', 'pull_back_turn'], ['weak_foot_dribble']],
      [['step_over', 'scissors'], ['matthews', 'cruyff'], ['roulette', 'pull_back_turn'], ['elastico', 'shoulder_fake'], ['weak_foot_dribble']]
    ),
  },
  BALL7: {
    group: 'ball',
    title: 'Футзал: ловкость в тесноте',
    focus: 'Всё на месте, хватает 1×1 м, тихо и без прыжков',
    slots: L(
      [['futsal_box', 'toe_taps'], ['clock_taps', 'pendulum'], ['sole_l', 'sole_slide', 'sole_roll'], ['drag_push', 'v_pull'], ['scissors', 'inside_roll']],
      [['futsal_box', 'toe_taps'], ['clock_taps', 'pendulum'], ['sole_l', 'sole_slide'], ['croqueta', 'drag_push'], ['scissors', 'knee_juggle'], ['first_touch_away', 'thigh_control']],
      [['futsal_box', 'clock_taps'], ['sole_l', 'sole_slide'], ['croqueta', 'drag_push'], ['scissors', 'knee_juggle'], ['pressure_clock', 'scan_touch'], ['first_touch_away', 'thigh_control', 'juggle_weak']]
    ),
  },
  BALL8: {
    group: 'ball',
    title: 'Игра под давлением',
    focus: 'Осмотр поля, закрытие мяча корпусом, приём от «соперника»',
    slots: L(
      [['blind_touch', 'scan_touch'], ['shield_dribble', 'pressure_clock', 'box_dribble'], ['first_touch_away', 'thigh_control'], ['juggle_catch', 'knee_juggle']],
      [['scan_touch', 'blind_touch'], ['shield_dribble', 'pressure_clock', 'box_dribble'], ['first_touch_away', 'thigh_control'], ['two_touch', 'wall_rondo', 'cushion_pass'], ['juggle_weak', 'knee_juggle']],
      [['scan_touch', 'blind_touch'], ['pressure_clock', 'shield_dribble'], ['first_touch_away', 'thigh_control'], ['wall_rondo', 'two_touch', 'cushion_pass'], ['croqueta', 'drag_push'], ['juggle_weak', 'knee_juggle']]
    ),
  },
  REC: {
    group: 'recovery',
    title: 'Восстановление',
    focus: 'Мобильность и лёгкая растяжка',
    light: true,
    slots: L(
      one('hip_mob', 'leg_swings', 'glute_bridge', 'dead_bug', 'superman'),
      one('hip_mob', 'leg_swings', 'glute_bridge', 'dead_bug', 'superman'),
      one('hip_mob', 'leg_swings', 'glute_bridge', 'dead_bug', 'superman')
    ),
  },
};

// запасные «тихие» упражнения на месте: если места мало (режим 1×1 м), слот не пропадает, а заменяется ими
const TINY_POOL = { novice: ['sole_l', 'drag_push', 'clock_taps', 'toe_taps', 'pendulum'], middle: ['sole_l', 'drag_push', 'clock_taps', 'croqueta', 'sole_slide'], pro: ['croqueta', 'sole_l', 'drag_push', 'clock_taps', 'sole_slide'] };
for (const code of ['BALL2', 'BALL3', 'BALL5', 'BALL6']) {
  for (const lv of Object.keys(TINY_POOL)) {
    SESSIONS[code].slots[lv].forEach((opts, i) => { opts.push(...TINY_POOL[lv].slice(i % 3).concat(TINY_POOL[lv].slice(0, i % 3))); });
  }
}

// [день недели, утро, вариант, вечер, вариант]; 1 = понедельник. Вечер null = без второй сессии.
const SCHEDULE = {
  novice: [[1, 'LEGS', 1, 'BALL1', 1], [3, 'UPPER', 1, 'BALL2', 1], [5, 'SPEED', 1, 'BALL3', 1], [6, 'REC', 1, null, 1]],
  middle: [[1, 'LEGS', 1, 'BALL1', 1], [2, 'UPPER', 1, 'BALL2', 1], [4, 'CORE', 1, 'BALL3', 1], [5, 'SPEED', 1, 'BALL1', 1], [7, 'REC', 1, null, 1]],
  pro: [[1, 'LEGS', 1, 'BALL1', 1], [2, 'UPPER', 1, 'BALL2', 1], [3, 'SPEED', 1, 'BALL3', 1], [5, 'UPPER', 2, 'BALL2', 1], [6, 'LEGS', 2, 'BALL1', 1], [7, 'REC', 1, null, 1]],
};

// группы тренировок для каталога
const SESSION_GROUPS = [
  { key: 'strength', label: 'Сила', text: 'Ноги, верх тела, пресс и кор' },
  { key: 'speed', label: 'Скорость', text: 'Ловкость, смена направления, выносливость' },
  { key: 'ball', label: 'С мячом', text: 'Чеканка, дриблинг, финты, футзал, игра под давлением' },
  { key: 'recovery', label: 'Восстановление', text: 'Мобильность и лёгкая растяжка' },
];

const WARM = ['jog', 'arm_circles', 'leg_swings', 'hip_mob', 'sl_balance'];
const WARM_BALL = ['jog', 'leg_swings', 'hip_mob', 'sl_balance'];
const COOL = ['quad_stretch', 'hams_stretch', 'calf_stretch'];
// если мяча нет, вечер заменяем работой без него
const NO_BALL = ['fast_feet', 'shuffle', 'skater', 'high_knees', 'glute_bridge'];

module.exports = { SESSION_GROUPS, SESSIONS, SCHEDULE, WARM, WARM_BALL, COOL, NO_BALL };
