import test from 'node:test';
import assert from 'node:assert/strict';
import { parseJsonLoose, normalizeOdometer, normalizeReceipt, normalize, filledFields } from '../src/aiParse.js';

test('parseJsonLoose 去掉围栏与前后说明', () => {
  const text = 'Sure, here it is:\n```json\n{"odometer": 12345}\n```\nHope it helps.';
  assert.deepEqual(parseJsonLoose(text), { odometer: 12345 });
});

test('parseJsonLoose 容忍纯 JSON 与数字字符串', () => {
  assert.deepEqual(parseJsonLoose('{"odometer":"12,340"}'), { odometer: '12,340' });
});

test('parseJsonLoose 坏输入返回 null', () => {
  assert.equal(parseJsonLoose('no json here'), null);
  assert.equal(parseJsonLoose(''), null);
  assert.equal(parseJsonLoose(null), null);
  assert.equal(parseJsonLoose('{broken'), null);
});

test('normalizeOdometer 去掉千分位并取整', () => {
  assert.deepEqual(normalizeOdometer({ odometer: '48,210 mi' }), { odometer: 48210 });
  assert.deepEqual(normalizeOdometer({ odometer: 12345.6 }), { odometer: 12346 });
});

test('normalizeOdometer 超范围或缺失返回 null', () => {
  assert.deepEqual(normalizeOdometer({ odometer: null }), { odometer: null });
  assert.deepEqual(normalizeOdometer({ odometer: 5000000 }), { odometer: null });
  assert.deepEqual(normalizeOdometer({ odometer: -20 }), { odometer: null });
  assert.deepEqual(normalizeOdometer('garbage'), { odometer: null });
});

test('normalizeReceipt 只保留契约字段', () => {
  const out = normalizeReceipt({
    date: '2026-02-14', cost: '$89.50', vendor: 'Jiffy Lube',
    items: ['机油', '', '机滤'], advice: '尽早更换刹车片',
  });
  assert.deepEqual(out, { date: '2026-02-14', cost: 89.5, vendor: 'Jiffy Lube', items: ['机油', '机滤'] });
  assert.equal('advice' in out, false);
});

test('normalizeReceipt 非法日期与负数金额归零为 null', () => {
  const out = normalizeReceipt({ date: '02/14/2026', cost: -3 });
  assert.equal(out.date, null);
  assert.equal(out.cost, null);
});

test('normalize 按 kind 分派', () => {
  assert.deepEqual(normalize('odometer', { odometer: 1000 }), { odometer: 1000 });
  assert.deepEqual(normalize('receipt', { vendor: 'Shell' }), { date: null, cost: null, vendor: 'Shell', items: [] });
});

test('filledFields 只列出非空项', () => {
  assert.deepEqual(filledFields({ date: null, cost: 12, vendor: null, items: [] }), ['cost']);
  assert.deepEqual(filledFields(null), []);
});
