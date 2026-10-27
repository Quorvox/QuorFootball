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
      one('juggle_catch', 'juggle', 'toe_taps', 'inside_roll', 'sole_roll'),
      one('juggle_alt', 'juggle', 'toe_taps', 'inside_roll', 'v_pull'),
      one('juggle_thigh', 'juggle_weak', 'juggle_alt', 'v_pull', 'sole_roll')
    ),
  },
  BALL2: {
    group: 'ball',
    outdoor: true,
    title: 'Мяч: удар и пас',
    focus: 'Пас внутренней стороной, удар подъёмом, приём',
    slots: L(
      [['wall_pass', 'gate_pass', 'inside_roll'], ['first_touch_wall', 'accuracy_stop', 'sole_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'v_pull'], ['dribble_turns', 'pendulum']],
      [['wall_pass', 'gate_pass', 'inside_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'v_pull'], ['first_touch_wall', 'accuracy_stop', 'sole_roll'], ['dribble_turns', 'box_dribble'], ['weak_foot_dribble']],
      [['wall_pass', 'gate_pass', 'inside_roll'], ['instep_wall', 'shoot_target', 'chair_pass', 'v_pull'], ['first_touch_wall', 'accuracy_stop', 'sole_roll'], ['juggle_weak', 'low_juggle'], ['weak_foot_dribble']]
    ),
  },
  BALL3: {
    group: 'ball',
    outdoor: true,
    title: 'Мяч: ведение и слабая нога',
    focus: 'Ведение, развороты, работа слабой ногой',
    slots: L(
      [['figure8', 'box_dribble'], ['inside_outside', 'pendulum'], ['dribble_turns', 'pull_back_turn'], ['weak_foot_dribble']],
      [['cone_dribble', 'box_dribble', 'figure8'], ['inside_outside', 'pendulum'], ['cruyff', 'scissors', 'dribble_turns'], ['weak_foot_dribble'], ['blind_touch', 'juggle_weak']],
      [['cone_dribble', 'box_dribble', 'figure8'], ['inside_outside', 'pendulum'], ['cruyff', 'scissors'], ['pull_back_turn', 'dribble_turns'], ['weak_foot_dribble'], ['blind_touch', 'juggle_weak']]
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
  { key: 'ball', label: 'С мячом', text: 'Чеканка, пас, удар, ведение' },
  { key: 'recovery', label: 'Восстановление', text: 'Мобильность и лёгкая растяжка' },
];

const WARM = ['jog', 'arm_circles', 'leg_swings', 'hip_mob', 'sl_balance'];
const WARM_BALL = ['jog', 'leg_swings', 'hip_mob', 'sl_balance'];
const COOL = ['quad_stretch', 'hams_stretch', 'calf_stretch'];
// если мяча нет, вечер заменяем работой без него
const NO_BALL = ['fast_feet', 'shuffle', 'skater', 'high_knees', 'glute_bridge'];

module.exports = { SESSION_GROUPS, SESSIONS, SCHEDULE, WARM, WARM_BALL, COOL, NO_BALL };
