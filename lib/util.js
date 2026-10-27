// Даты, оценка времени тренировки, группы упражнений.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDate(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function addDays(s, n) {
  const d = new Date(s + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 1 = понедельник ... 7 = воскресенье
function weekdayOf(s) {
  const w = new Date(s + 'T00:00:00Z').getUTCDay();
  return w === 0 ? 7 : w;
}

function weekDates(s) {
  const mon = addDays(s, -(weekdayOf(s) - 1));
  return Array.from({ length: 7 }, (_, i) => addDays(mon, i));
}

// грубо: повтор = 3 сек, плюс отдых между подходами и 5 сек на переход
function estimateMin(exercises) {
  let sec = 0;
  for (const e of exercises) {
    const work = e.kind === 'time' ? e.amount : e.amount * 3;
    sec += work * e.sets + e.rest * Math.max(0, e.sets - 1) + 5;
  }
  return Math.max(1, Math.round(sec / 60));
}

module.exports = { isDate, addDays, weekdayOf, weekDates, estimateMin };
