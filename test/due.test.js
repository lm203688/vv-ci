import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDate, addMonths, daysBetween, computeDue, vehicleStatus,
  milesToKm, kmToMiles, formatRemaining, toCsv, STATUS,
} from '../src/due.js';

const A = (name, fn) => test(name, fn);

A('parseDate 接受合法日期、拒绝非法', () => {
  assert.deepEqual(parseDate('2026-11-19'), { y: 2026, mo: 11, d: 19 });
  assert.equal(parseDate('2026-13-01'), null);
  assert.equal(parseDate('2026-02-30'), null);
  assert.equal(parseDate('2026/11/19'), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate(20261119), null);
});

A('addMonths 常规与月末收敛', () => {
  assert.equal(addMonths('2026-01-15', 6), '2026-07-15');
  assert.equal(addMonths('2026-11-19', 12), '2027-11-19');
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  assert.equal(addMonths('2026-03-31', 1), '2026-04-30');
  assert.equal(addMonths('2026-12-31', 1), '2027-01-31');
  assert.equal(addMonths('bogus', 1), null);
  assert.equal(addMonths('2026-01-15', 1.5), null);
});

A('addMonths 闰年', () => {
  assert.equal(addMonths('2028-01-31', 1), '2028-02-29');
  assert.equal(addMonths('2028-02-29', 12), '2029-02-28');
  assert.equal(addMonths('2028-02-29', 0), '2028-02-29');
});

A('daysBetween 跨月跨年与夏令时（3 月切换）', () => {
  assert.equal(daysBetween('2026-11-19', '2026-11-19'), 0);
  assert.equal(daysBetween('2026-11-19', '2026-12-19'), 30);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-07', '2026-03-08'), 1); // 美国夏令时切换日，仍应是 1 天
  assert.equal(daysBetween('2028-02-28', '2028-03-01'), 2); // 闰年
  assert.equal(daysBetween('2026-11-19', '2026-11-05'), -14);
  assert.equal(daysBetween('bad', '2026-11-19'), null);
});

A('computeDue 正常 → 待办 → 紧急 → 逾期', () => {
  const item = { lastMiles: 10000, lastDate: '2026-01-10', intervalMiles: 5000, intervalMonths: 12 };
  const ok = computeDue(item, { odometer: 10100, today: '2026-02-01' });
  assert.equal(ok.status, STATUS.OK);
  assert.equal(ok.milesLeft, 4900);
  assert.equal(ok.daysLeft, 343);

  const due = computeDue(item, { odometer: 14000, today: '2026-02-01' });
  assert.equal(due.status, STATUS.DUE); // 剩 1000 mi = 20% < 25%

  const urgent = computeDue(item, { odometer: 14600, today: '2026-02-01' });
  assert.equal(urgent.status, STATUS.URGENT); // 剩 400 mi = 8% < 10%

  const over = computeDue(item, { odometer: 16000, today: '2026-02-01' });
  assert.equal(over.status, STATUS.OVERDUE);
  assert.equal(over.milesLeft, -1000);
});

A('computeDue 时间先到也算（里程还很远）', () => {
  const item = { lastMiles: 10000, lastDate: '2025-01-01', intervalMiles: 50000, intervalMonths: 12 };
  const r = computeDue(item, { odometer: 11000, today: '2026-02-01' });
  assert.equal(r.status, STATUS.OVERDUE);
  assert.equal(r.daysLeft, -31);
  assert.equal(r.nextDueDate, '2026-01-01');
});

A('computeDue 从未保养过 → 立即待办，不崩溃', () => {
  const r = computeDue(
    { lastMiles: null, lastDate: null, intervalMiles: 5000, intervalMonths: 6 },
    { odometer: 30000, today: '2026-11-19' }
  );
  assert.equal(r.status, STATUS.DUE);
  assert.equal(r.milesLeft, 5000);
  assert.equal(r.daysLeft, null);
  assert.equal(r.reason, 'never_serviced');
});

A('computeDue 里程回绕（换表/改表）→ 以新里程为基线', () => {
  const r = computeDue(
    { lastMiles: 80000, lastDate: '2026-06-01', intervalMiles: 5000, intervalMonths: 6 },
    { odometer: 1200, today: '2026-11-19' }
  );
  assert.equal(r.rebased, true);
  assert.equal(r.milesLeft, 5000);
  assert.equal(r.status, STATUS.URGENT); // 里程按新基线重置；时间侧 2026-12-01 只剩 12 天 → 紧急
});

A('computeDue 多车互不干扰', () => {
  const it1 = { lastMiles: 10000, lastDate: '2026-01-01', intervalMiles: 5000, intervalMonths: 6 };
  const it2 = { lastMiles: 10000, lastDate: '2025-01-01', intervalMiles: 5000, intervalMonths: 6 };
  const r1 = computeDue(it1, { odometer: 10100, today: '2026-02-01' });
  const r2 = computeDue(it2, { odometer: 10100, today: '2026-02-01' });
  assert.equal(r1.status, STATUS.OK);
  assert.equal(r2.status, STATUS.OVERDUE);
});

A('vehicleStatus 取最差', () => {
  assert.equal(vehicleStatus([]), STATUS.OK);
  assert.equal(vehicleStatus([{ status: STATUS.OK }, { status: STATUS.DUE }]), STATUS.DUE);
  assert.equal(vehicleStatus([{ status: STATUS.DUE }, { status: STATUS.OVERDUE }]), STATUS.OVERDUE);
  assert.equal(vehicleStatus([{ status: STATUS.OK }, { status: STATUS.URGENT }]), STATUS.URGENT);
});

A('单位换算', () => {
  assert.equal(milesToKm(100), 160.9);
  assert.equal(kmToMiles(160.9), 100);
  assert.equal(milesToKm(0), 0);
});

A('formatRemaining 文案', () => {
  assert.equal(formatRemaining(-120, null), '120 mi overdue');
  assert.equal(formatRemaining(0, -3), '3 days overdue');
  assert.equal(formatRemaining(400, 12), '12 days');
  assert.equal(formatRemaining(400, 90), '3 mo');
  assert.equal(formatRemaining(1000, null), '1000 mi');
  assert.equal(formatRemaining(1000, null, 'km'), '1609.3 km');
});

A('CSV 导出转义', () => {
  const csv = toCsv([
    { date: '2026-11-19', type: 'oil', odometer: 12340, cost: 89.5, vendor: 'Jiffy Lube', notes: 'ok' },
    { date: '2026-11-20', type: 'repair', odometer: 12400, cost: 12, vendor: 'A, B "C"', notes: 'line1\nline2' },
  ]);
  const lines = csv.split('\n');
  assert.equal(lines[0], 'date,type,odometer,cost,vendor,notes');
  assert.equal(lines[1], '2026-11-19,oil,12340,89.5,Jiffy Lube,ok');
  assert.equal(lines[2].startsWith('2026-11-20,repair,12400,12,"A, B ""C"""'), true);
});

