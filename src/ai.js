// AI 抽取（PRD §七）：只做输入层，直连厂商，不中转；返回严格 JSON，字段缺失为 null。
import { parseJsonLoose, normalize } from './aiParse.js';

export const PROVIDERS = [
  { id: 'openai', label: 'OpenAI', hint: 'gpt-4o-mini' },
  { id: 'anthropic', label: 'Anthropic', hint: 'claude-3-5-haiku' },
  { id: 'gemini', label: 'Gemini', hint: 'gemini-2.0-flash' },
];

const SCHEMA = {
  odometer: '{"odometer": <total odometer reading as an integer in miles, or null>}',
  receipt: '{"date": "YYYY-MM-DD or null", "cost": <total amount as a number or null>, "vendor": "shop name or null", "items": ["service names, at most 6"]}',
};

function buildPrompt(kind) {
  return [
    'You extract structured data from one photo. Return JSON only, no commentary.',
    kind === 'odometer'
      ? 'Task: read the total odometer on the dashboard — not a trip meter, not a speed limit.'
      : 'Task: read the fields on this service receipt or invoice.',
    `The JSON shape must be exactly: ${SCHEMA[kind] || SCHEMA.receipt}`,
    'Any field you cannot read with confidence must be null. Do not guess, do not advise.',
  ].join('\n');
}

const timeoutSignal = (ms) => {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
};

async function callOpenAI({ base64, mime, prompt, key, fetchImpl, model }) {
  const res = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract this photo.' },
            { type: 'image_url', image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `OpenAI ${res.status}`);
  return json?.choices?.[0]?.message?.content || '';
}

async function callAnthropic({ base64, mime, prompt, key, fetchImpl, model }) {
  const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: model || 'claude-3-5-haiku-latest',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Anthropic ${res.status}`);
  return json?.content?.[0]?.text || '';
}

async function callGemini({ base64, mime, prompt, key, fetchImpl, model }) {
  const m = model || 'gemini-2.0-flash';
  const res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: base64 } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || `Gemini ${res.status}`);
  return json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

const CALLS = { openai: callOpenAI, anthropic: callAnthropic, gemini: callGemini };

/**
 * 抽取一张照片。返回 { ok, result, raw, error }，不抛异常，UI 只需看 ok。
 * key 为空时直接返回 ok:false, reason:'no-key'，调用方应保持纯手动录入。
 */
export async function extract({ kind = 'receipt', base64, mime = 'image/jpeg', provider, key, model, fetchImpl } = {}) {
  if (!key) return { ok: false, reason: 'no-key', result: null };
  if (!base64) return { ok: false, reason: 'no-image', result: null };
  const fn = CALLS[provider || 'openai'];
  if (!fn) return { ok: false, reason: 'bad-provider', result: null };
  const t = timeoutSignal(25000);
  try {
    const text = await fn({ base64, mime, prompt: buildPrompt(kind), key, fetchImpl: fetchImpl || fetch, model });
    const raw = parseJsonLoose(text);
    if (!raw) return { ok: false, reason: 'bad-json', result: null };
    return { ok: true, result: normalize(kind, raw), raw };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    return { ok: false, reason: /abort/i.test(msg) ? 'timeout' : 'error', error: msg, result: null };
  } finally {
    t.done();
  }
}
