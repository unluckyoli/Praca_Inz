export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date, months) {
  const d = new Date(date);
  const copy = new Date(d);
  copy.setMonth(copy.getMonth() + months);

  return copy;
}

export function getWindow(period, now = new Date()) {
  const windowStart = new Date(now);

  windowStart.setSeconds(0, 0);

  let windowEnd;
  if (period === "WEEK") {
    windowEnd = addDays(windowStart, 7);
  } else if (period === "MONTH") {
    windowEnd = addMonths(windowStart, 1);
  } else {
    throw new Error(`Unknown period: ${period}`);
  }

  return { windowStart, windowEnd };
}
