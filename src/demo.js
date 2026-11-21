// 仅演示构建（EXPO_PUBLIC_DEMO=1）生效：种一辆示例车并把界面按固定时间轴走一遍，
// 每到一个状态写一个 Documents/step_<name>.txt 标记，CI 轮询到标记就截图。
// 生产构建不会进入这里（env 不存在），代码保留是为了让验收抓图可复现。
import * as FS from 'expo-file-system/legacy';
import { listVehicles, listItems, createVehicle, getDb, addLog } from './db.js';
import { rescheduleAll, ensurePermission, permissionInfo, lastSchedule, countScheduled } from './notify.js';
import { syncWidget } from './widget.js';

export const isDemo = process.env.EXPO_PUBLIC_DEMO === '1';
const today = () => new Date().toLocaleDateString('en-CA');

export async function mark(step) {
  try {
    await FS.writeAsStringAsync(FS.documentDirectory + `step_${step}.txt`, `${step} ${Date.now()}`);
  } catch (e) {
    // 抓图环境忽略
  }
}

// 写任意诊断文本（排程报错原文等），CI 直接 cat
export async function note(name, text) {
  try {
    await FS.writeAsStringAsync(FS.documentDirectory + `${name}.txt`, String(text));
  } catch (e) {
    // 抓图环境忽略
  }
}

const SEED = {
  nickname: 'Daily Camry',
  make: 'Toyota',
  model: 'Camry',
  year: 2019,
  odometer: 48210,
  date: '2026-10-30',
};

async function seed() {
  const vs = await listVehicles();
  if (vs.length) return vs[0].id;
  const vid = await createVehicle(SEED);
  const d = await getDb();
  await d.runAsync(
    'UPDATE items SET last_miles = ?, last_date = ? WHERE vehicle_id = ? AND name = ?',
    [43400, '2026-02-14', vid, 'Oil & filter']
  );
  await d.runAsync(
    'UPDATE items SET last_miles = ?, last_date = ? WHERE vehicle_id = ? AND name = ?',
    [41000, '2026-01-20', vid, 'Tire rotation']
  );
  await addLog(vid, { type: 'service', date: '2026-02-14', odometer: 43400, cost: 89.5, vendor: 'Jiffy Lube', itemId: null, notes: null, photoUris: [] });
  await addLog(vid, { type: 'fuel', date: '2026-10-30', odometer: 48210, cost: 52.4, vendor: 'Shell', itemId: null, notes: null, photoUris: [] });
  return vid;
}

// navRef 是 useNavigationContainerRef() 的返回值，方法直接挂在对象上
export function runDemo(navRef) {
  const shots = process.env.EXPO_PUBLIC_SHOTS === '1';
  let alive = true;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(() => { if (alive) { try { fn(); } catch (e) { /* ignore */ } } }, ms));
  const go = (name, params) => {
    if (!navRef || typeof navRef.isReady !== 'function' || !navRef.isReady()) return;
    navRef.navigate(name, params);
  };

  (async () => {
    let vid = null;
    try {
      vid = await seed();
    } catch (e) {
      await mark('error');
      return;
    }
    later(4000, () => mark('garage'));
    // 提前把通知授权走一遍并把状态码写进标记，供 CI 判断 provisional 是否生效
    later(1000, async () => {
      const ok = await ensurePermission();
      const info = await permissionInfo();
      await mark(`perm${ok ? 1 : 0}_${info.status}`);
    });
    // 直接写一次 App Group 小组件数据，供 CI 读共享容器验证
    later(12000, async () => {
      try {
        const ok = await syncWidget({ car: 'Daily Camry', label: 'Oil & filter', days: -3 });
        await mark(`widget${ok ? 1 : 0}`);
      } catch (e) {
        // 演示环境忽略
      }
    });
    later(14000, () => go('Detail', { id: vid }));
    later(15500, () => mark('detail'));
    later(20000, () => go('Record', { id: vid }));
    later(21500, () => mark('record'));
    later(48000, () => mark('saved'));
    later(50500, () => { if (navRef && typeof navRef.goBack === 'function') navRef.goBack(); });
    later(52000, () => mark('garage2'));
    // 演示构建走 provisional 授权，模拟器上不弹框也能真排提醒；排完把条数写进标记供 CI 断言
    later(54000, async () => {
      try {
        const vs = await listVehicles();
        if (!vs.length) return;
        const its = await listItems(vs[0].id);
        const n = await rescheduleAll(vs[0], its, today());
        const info = await permissionInfo();
        const diag = lastSchedule();
        await mark(`notif${n}_${info.status}_${diag.items}_${diag.withDue}_${diag.errors.length}`);
        await note('sched_full', JSON.stringify(diag.errors));
        await mark(`pend${await countScheduled()}`);
      } catch (e) {
        // 演示环境忽略
      }
    });
    later(56000, () => go('Settings'));
    later(57500, () => mark('settings'));
    if (!shots) later(62000, () => mark('probe'));
  })();

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
  };
}
