import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, PROVIDERS } from '../src/ai.js';

const fakeFetch = (body, status = 200) => async () => ({ ok: status < 400, status, json: async () => body });
const PNG = 'AAAA';

test('没有 key 时不发请求，直接降级', async () => {
  const r = await extract({ kind: 'odometer', base64: PNG, key: '' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-key');
});

test('openai 返回合法 JSON 时归一化成功', async () => {
  const r = await extract({
    kind: 'odometer', base64: PNG, provider: 'openai', key: 'k',
    fetchImpl: fakeFetch({ choices: [{ message: { content: '{"odometer":"48,210"}' } }] }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.result, { odometer: 48210 });
});

test('anthropic 路径同样走通', async () => {
  const r = await extract({
    kind: 'receipt', base64: PNG, provider: 'anthropic', key: 'k',
    fetchImpl: fakeFetch({ content: [{ text: '{"date":"2026-02-14","cost":89.5,"vendor":"Jiffy Lube","items":["机油"]}' }] }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.result, { date: '2026-02-14', cost: 89.5, vendor: 'Jiffy Lube', items: ['机油'] });
});

test('gemini 路径同样走通', async () => {
  const r = await extract({
    kind: 'odometer', base64: PNG, provider: 'gemini', key: 'k',
    fetchImpl: fakeFetch({ candidates: [{ content: { parts: [{ text: '```json\n{"odometer": 99999}\n```' }] } }] }),
  });
  assert.equal(r.ok, true);
  assert.deepEqual(r.result, { odometer: 99999 });
});

test('模型回自由文本时判为 bad-json，不落库', async () => {
  const r = await extract({
    kind: 'receipt', base64: PNG, provider: 'openai', key: 'k',
    fetchImpl: fakeFetch({ choices: [{ message: { content: '你的刹车片该换了' } }] }),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-json');
});

test('HTTP 401 返回 error 且带厂商消息', async () => {
  const r = await extract({
    kind: 'odometer', base64: PNG, provider: 'openai', key: 'bad',
    fetchImpl: fakeFetch({ error: { message: 'Incorrect API key provided' } }, 401),
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'error');
  assert.match(r.error, /Incorrect API key/);
});

test('未知 provider 不崩', async () => {
  const r = await extract({ kind: 'odometer', base64: PNG, provider: 'nope', key: 'k', fetchImpl: fakeFetch({}) });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'bad-provider');
});

test('PROVIDERS 覆盖三家', () => {
  assert.deepEqual(PROVIDERS.map((p) => p.id), ['openai', 'anthropic', 'gemini']);
});
