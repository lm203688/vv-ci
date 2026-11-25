// 桌面小组件（WidgetKit）数据同步：把「最近一辆车最紧急的一项」写进 App Group，
// 由 VehicleVaultWidget 读取显示。原生模块缺失时静默降级，不影响任何界面。
import {
  setWidgetData,
  clearWidgetData,
  liveActivityEnabled,
  startServiceActivity,
  endServiceActivity,
} from '../modules/vv-shared';

// 只有临期（含逾期）才值得占锁屏；其余情况把活动收掉，避免用户天天看到一条不紧急的横幅。
export const LIVE_ACTIVITY_WINDOW_DAYS = 7;

/** 从车辆 + 保养项里挑最紧急的一项 */
export function pickNext(items = []) {
  if (!items.length) return null;
  const order = { OVERDUE: 0, URGENT: 1, DUE: 2, OK: 3 };
  return [...items].sort((a, b) => (order[a.due.status] ?? 9) - (order[b.due.status] ?? 9))[0];
}

/**
 * @param {{car?: string, label?: string, days?: number}|null} payload 车库算出的最紧急项
 */
export async function syncWidget(payload) {
  const car = (payload && payload.car) || '';
  const label = (payload && payload.label) || '';
  const days = payload && Number.isFinite(payload.days) ? payload.days : 0;
  if (!car || !label) {
    try {
      clearWidgetData();
      await endServiceActivity();
    } catch (e) {
      // 忽略
    }
    return false;
  }
  const ok = setWidgetData(car, label, days);
  await syncLiveActivity(car, label, days);
  return ok;
}

/**
 * 锁屏实时活动。days 为负数表示逾期。
 */
export async function syncLiveActivity(car, label, days) {
  try {
    if (!liveActivityEnabled()) return false;
    if (!(days <= LIVE_ACTIVITY_WINDOW_DAYS)) {
      await endServiceActivity();
      return false;
    }
    const detail = days < 0 ? `${-days} days overdue` : days === 0 ? 'Due today' : `Due in ${days} days`;
    return await startServiceActivity(car, label, detail, days);
  } catch (e) {
    return false;
  }
}
