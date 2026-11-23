// Feedback loop primitives (闸门 7) — VehicleVault 版，ESM。
// 纯函数：不联网、不上传、不落库；应用只组装诊断包，交给用户自己的邮件/分享面板。
// 只带 id 与代码，绝不带输入内容、照片或个人信息。

export const FEEDBACK_EMAIL = '463102527@qq.com';

export const CATEGORIES = ['wrong_reminder', 'data_loss', 'crash', 'hard_to_use', 'new_request', 'other'];

export const CATEGORY_LABELS = {
  wrong_reminder: 'Wrong reminder date',
  data_loss: 'Records missing',
  crash: 'Crash',
  hard_to_use: 'Hard to use',
  new_request: 'Idea',
  other: 'Other',
};

const APP = 'VehicleVault';
const PREFIX = 'VV';
const MAX_ACTIONS = 20;

export function createSession(meta = {}) {
  return {
    app: APP,
    version: meta.version || '1.0.1',
    build: meta.build || '1',
    device: meta.device || '',
    os: meta.os || '',
    locale: meta.locale || 'en-US',
    startedAt: new Date().toISOString(),
    actions: [],
    errorCode: null,
  };
}

// 进程内单例：记录用户走过的屏幕名（只有名字，没有输入内容）
let session = null;
export function getSession(meta = {}) {
  if (!session) session = createSession(meta);
  return session;
}

export function track(name) {
  if (!session || typeof name !== 'string' || !name) return;
  session.actions.push(name);
  if (session.actions.length > MAX_ACTIONS) session.actions.shift();
}

export function buildBundle(input = {}, meta = {}, s = null) {
  const sess = s || getSession(meta);
  const category = CATEGORIES.includes(input.category) ? input.category : 'other';
  return {
    app: sess.app,
    version: sess.version,
    build: sess.build,
    device: sess.device,
    os: sess.os,
    locale: sess.locale,
    context: typeof input.context === 'string' ? input.context : null,
    last_actions: sess.actions.slice(-MAX_ACTIONS),
    error_code: input.errorCode || sess.errorCode || null,
    category,
    user_note: typeof input.note === 'string' ? input.note.slice(0, 1200) : '',
    created_at: new Date().toISOString(),
  };
}

export function nextId(existing = [], prefix = PREFIX) {
  let max = 0;
  for (const id of existing) {
    const m = /^([A-Z]+)-(\d{4})$/.exec(String(id));
    if (m && m[1] === prefix) max = Math.max(max, Number(m[2]));
  }
  return `${prefix}-${String(max + 1).padStart(4, '0')}`;
}

export function validateBundle(b) {
  const errors = [];
  if (!b || typeof b !== 'object') return ['bundle must be an object'];
  for (const k of ['app', 'version', 'build', 'locale', 'category', 'created_at']) {
    if (!b[k]) errors.push(`missing ${k}`);
  }
  if (!CATEGORIES.includes(b.category)) errors.push('unknown category');
  if (Array.isArray(b.last_actions)) {
    if (b.last_actions.length > MAX_ACTIONS) errors.push('too many actions');
    if (b.last_actions.some((a) => typeof a !== 'string')) errors.push('actions must be ids');
  } else errors.push('last_actions must be an array');
  if (typeof b.user_note === 'string' && b.user_note.length > 1200) errors.push('note too long');
  return errors;
}

export function toText(b) {
  return [
    `Feedback ${b.id || ''}`.trim(),
    `App: ${b.app} ${b.version} (build ${b.build})`,
    `Device: ${b.device} | OS: ${b.os} | Locale: ${b.locale}`,
    `Category: ${b.category}`,
    `Context: ${b.context || 'n/a'}`,
    `Error code: ${b.error_code || 'n/a'}`,
    `Recent screens: ${(b.last_actions || []).join(' > ') || 'n/a'}`,
    '',
    'What happened:',
    b.user_note || '(describe what you expected and what you saw)',
    '',
    '— No photos, texts or personal data are included. You can edit this before sending.',
  ].join('\n');
}

export function toMailto(b, address = FEEDBACK_EMAIL) {
  const subject = `[VehicleVault] ${b.category} · ${b.version} · ${b.id || 'draft'}`;
  const body = toText(b);
  return `mailto:${address}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
