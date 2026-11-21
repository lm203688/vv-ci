// 纯函数：把模型返回的文本收敛成固定 schema 的对象。不做任何网络与原生依赖，便于本地单测。
// 契约（PRD §七）：字段缺失或不可信一律返回 null，禁止自由文本。

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 从可能带 ```json 围栏 / 前后缀说明的文本里取出 JSON 对象 */
export function parseJsonLoose(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

const num = (v) => {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const str = (v, max = 80) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/** 仪表盘 / 里程表照片 → { odometer } */
export function normalizeOdometer(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const odometer = num(o.odometer);
  if (odometer === null || odometer < 0 || odometer > 2000000) return { odometer: null };
  return { odometer: Math.round(odometer) };
}

/** 保养收据照片 → { date, cost, vendor, items[] } */
export function normalizeReceipt(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const date = typeof o.date === 'string' && DATE_RE.test(o.date) ? o.date : null;
  const cost = num(o.cost);
  const vendor = str(o.vendor, 40);
  const items = Array.isArray(o.items)
    ? o.items.map((i) => str(i, 40)).filter(Boolean).slice(0, 6)
    : [];
  return {
    date,
    cost: cost !== null && cost >= 0 && cost < 100000 ? cost : null,
    vendor,
    items,
  };
}

/** 统一入口：按抽取目标收敛 */
export function normalize(kind, raw) {
  return kind === 'odometer' ? normalizeOdometer(raw) : normalizeReceipt(raw);
}

/** 收集非空字段，供 UI 判断"这次抽到了什么" */
export function filledFields(result) {
  if (!result) return [];
  return Object.keys(result).filter((k) => {
    const v = result[k];
    return Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined;
  });
}
