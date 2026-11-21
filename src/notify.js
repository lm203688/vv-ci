// 本地到期通知：到期前 30 / 14 / 0 天各一次。全部本地调度，不联网。
import * as Notifications from 'expo-notifications';
import { computeDue } from './due';

const DAY = 86400000;
// 演示构建（EXPO_PUBLIC_DEMO=1）走 provisional 授权：iOS 会静默授予，不弹系统对话框，
// 因此在没有 UI 自动化的模拟器上也能把 30/14/0 三档提醒真正排进系统队列。正式构建仍走正常弹窗。
const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';
const PROVISIONAL = 3;

// 返回 { granted, status }：status 为 iOS 授权状态码（0 未决定 / 2 已授权 / 3 provisional / 4 拒绝）
export async function permissionInfo() {
  try {
    const cur = await Notifications.getPermissionsAsync();
    return { granted: !!cur.granted, status: cur && cur.ios ? cur.ios.status : null };
  } catch (e) {
    return { granted: false, status: null };
  }
}

function allowed(info) {
  return !!info && (info.granted || (isDemo && info.status === PROVISIONAL));
}

export async function ensurePermission() {
  try {
    if (allowed(await permissionInfo())) return true;
    const req = isDemo
      ? await Notifications.requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true, allowProvisional: true },
        })
      : await Notifications.requestPermissionsAsync();
    if (req && req.granted) return true;
    return isDemo && !!req && !!req.ios && req.ios.status === PROVISIONAL;
  } catch (e) {
    return false;
  }
}

function atNine(dateStr) {
  const d = new Date(dateStr + 'T09:00:00');
  return d;
}

// 供演示构建诊断用：记录上一次排程的项数、成功数与错误摘要
let LAST = { items: 0, withDue: 0, scheduled: 0, errors: [] };
export function lastSchedule() {
  return LAST;
}

/**
 * 重建全部提醒：先清空本 App 已排的通知，再按当前里程/日期重排。
 * 返回排入的通知条数。
 */
export async function rescheduleAll(vehicle, items, today, opts = {}) {
  const ok = opts.requestPermission === false
    ? (await hasPermission())
    : (await ensurePermission());
  LAST = { items: items ? items.length : 0, withDue: 0, scheduled: 0, errors: [] };
  if (!ok) {
    LAST.errors.push('permission-denied');
    return 0;
  }
  try {
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of existing) await Notifications.cancelScheduledNotificationAsync(n.identifier);
  } catch (e) {
    // 忽略清理失败，继续排新的
  }

  let count = 0;
  for (const item of items) {
    const due = computeDue(
      { lastMiles: item.last_miles, lastDate: item.last_date, intervalMiles: item.interval_miles, intervalMonths: item.interval_months },
      { odometer: vehicle.odometer, today }
    );
    if (!due.nextDueDate) continue;
    LAST.withDue += 1;
    const dueDate = atNine(due.nextDueDate);
    for (const offset of [30, 14, 0]) {
      const when = new Date(dueDate.getTime() - offset * DAY);
      if (when.getTime() <= Date.now() + 60 * 1000) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: offset === 0 ? `${item.name} is due` : `${item.name} due in ${offset} days`,
            body: `${vehicle.nickname} · every ${item.interval_miles} mi / ${item.interval_months} mo`,
            sound: 'default',
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
        });
        count += 1;
      } catch (e) {
        LAST.errors.push(String(e && e.message ? e.message : e).slice(0, 120));
      }
    }
  }
  LAST.scheduled = count;
  return count;
}

export async function hasPermission() {
  return allowed(await permissionInfo());
}

export async function countScheduled() {
  try {
    return (await Notifications.getAllScheduledNotificationsAsync()).length;
  } catch (e) {
    return 0;
  }
}