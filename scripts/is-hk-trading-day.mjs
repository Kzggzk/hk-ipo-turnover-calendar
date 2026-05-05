#!/usr/bin/env node

const holidays = new Map([
  ['2026-01-01', 'The first day of January'],
  ['2026-02-17', 'Lunar New Year\'s Day'],
  ['2026-02-18', 'The second day of Lunar New Year'],
  ['2026-02-19', 'The third day of Lunar New Year'],
  ['2026-04-03', 'Good Friday'],
  ['2026-04-04', 'The day following Good Friday'],
  ['2026-04-06', 'The day following Ching Ming Festival'],
  ['2026-04-07', 'The day following Easter Monday'],
  ['2026-05-01', 'Labour Day'],
  ['2026-05-25', 'The day following the Birthday of the Buddha'],
  ['2026-06-19', 'Tuen Ng Festival'],
  ['2026-07-01', 'HKSAR Establishment Day'],
  ['2026-09-26', 'The day following the Chinese Mid-Autumn Festival'],
  ['2026-10-01', 'National Day'],
  ['2026-10-19', 'The day following Chung Yeung Festival'],
  ['2026-12-25', 'Christmas Day'],
  ['2026-12-26', 'The first weekday after Christmas Day']
]);

function hkDateString() {
  if (process.env.HKIPO_RUN_DATE) return process.env.HKIPO_RUN_DATE;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function weekday(dateString) {
  return new Date(`${dateString}T12:00:00+08:00`).getUTCDay();
}

const date = hkDateString();
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  console.error(`Invalid HKIPO_RUN_DATE: ${date}`);
  process.exit(1);
}

const day = weekday(date);
if (day === 0 || day === 6) {
  console.log(`Non-trading day ${date}: weekend`);
  process.exit(10);
}

if (holidays.has(date)) {
  console.log(`Non-trading day ${date}: ${holidays.get(date)}`);
  process.exit(10);
}

console.log(`Trading day ${date}: refresh allowed`);
