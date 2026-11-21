// VehicleVault 到期推算内核（纯函数，无 IO、无依赖）
// 规则来源：项目\vehiclevault\PRD-v1.md 第五节

const MS_PER_DAY = 86400000;

/** 解析 YYYY-MM-DD 为本地日期三元组；非法输入返回 null */
export function parseDate(s) {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, mo - 1, d);
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) return null;
  return { y, mo, d };
}

export function formatDate({ y, mo, d }) {
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 按本地日期加月，月末自动收敛（1/31 + 1 月 = 2/28 或 2/29） */
export function addMonths(dateStr, months) {
  const p = parseDate(dateStr);
  if (!p || !Number.isInteger(months)) return null;
  const total = p.y * 12 + (p.mo - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12 + 1;
  const lastDay = new Date(ny, nm, 0).getDate();
  return formatDate({ y: ny, mo: nm, d: Math.min(p.d, lastDay) });
}

/** 两个本地日期相差天数（用 UTC 归一化，避开夏令时） */
export function daysBetween(fromStr, toStr) {
  const a = parseDate(fromStr), b = parseDate(toStr);
  if (!a || !b) return null;
  const ua = Date.UTC(a.y, a.mo - 1, a.d);
  const ub = Date.UTC(b.y, b.mo - 1, b.d);
  return Math.round((ub - ua) / MS_PER_DAY);
}

export const STATUS = { OVERDUE: 'overdue', URGENT: 'urgent', DUE: 'due', OK: 'ok' };

/**
 * 计算某个保养项的到期状态。
 * item:    { lastMiles, lastDate, intervalMiles, intervalMonths }
 * current: { odometer, today }
 */
export function computeDue(item, current) {
  const odometer = current.odometer;
  const today = current.today;
  const im = item.intervalMiles;

  // 从未保养过 → 立即待办（不崩溃、不返回负值）
  if (item.lastMiles == null || item.lastDate == null) {
    return {
      status: STATUS.DUE,
      milesLeft: im,
      daysLeft: null,
      nextDueDate: today,
      rebased: false,
      reason: 'never_serviced',
    };
  }

  const rebased = odometer < item.lastMiles;
  const baseMiles = rebased ? odometer : item.lastMiles;
  const milesLeft = Math.round(baseMiles + im - odometer);

  const nextDueDate = addMonths(item.lastDate, item.intervalMonths);
  const daysLeft = nextDueDate == null ? null : daysBetween(today, nextDueDate);

  let status = STATUS.OK;
  if (milesLeft < 0 || (daysLeft != null && daysLeft < 0)) status = STATUS.OVERDUE;
  else if (milesLeft < im * 0.1 || (daysLeft != null && daysLeft <= 14)) status = STATUS.URGENT;
  else if (milesLeft < im * 0.25 || (daysLeft != null && daysLeft <= 30)) status = STATUS.DUE;

  return { status, milesLeft, daysLeft, nextDueDate, rebased, reason: 'computed' };
}

/** 一辆车的整体状态 = 最差的那一项 */
export function vehicleStatus(items) {
  const order = { overdue: 3, urgent: 2, due: 1, ok: 0 };
  if (!items || items.length === 0) return STATUS.OK;
  let worst = STATUS.OK;
  for (const it of items) if (order[it.status] > order[worst]) worst = it.status;
  return worst;
}

/** 单位换算：mi <-> km */
export function milesToKm(mi) { return Math.round(mi * 1.609344 * 10) / 10; }
export function kmToMiles(km) { return Math.round(km / 1.609344 * 10) / 10; }

/** 人类可读的剩余量 */
export function formatRemaining(milesLeft, daysLeft, units = 'mi') {
  if (milesLeft < 0) {
    const v = Math.abs(milesLeft);
    return units === 'km' ? `${milesToKm(v)} km overdue` : `${v} mi overdue`;
  }
  if (daysLeft != null && daysLeft < 0) return `${Math.abs(daysLeft)} days overdue`;
  if (daysLeft == null) return units === 'km' ? `${milesToKm(milesLeft)} km` : `${milesLeft} mi`;
  const d = daysLeft;
  return d <= 30 ? `${d} days` : `${Math.round(d / 30)} mo`;
}

/** CSV 导出（记录表） */
export function toCsv(rows) {
  const head = ['date', 'type', 'odometer', 'cost', 'vendor', 'notes'];
  const q = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const body = rows.map((r) => [r.date, r.type, r.odometer, r.cost, r.vendor, r.notes].map(q).join(','));
  return [head.join(','), ...body].join('\n');
}
