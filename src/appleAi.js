// On-device Apple Intelligence bridge for Solshot.
// Every answer is produced by the Foundation Models framework through the native
// AppleFM module: nothing is uploaded, no key, no network. When the model is not
// available the call resolves to null and the UI says why instead of guessing.

import { requireNativeModule } from 'expo';

let mod = null;
try {
  mod = requireNativeModule('AppleFM');
} catch {
  mod = null;
}

const REASONS = {
  ready: 'ready on this device',
  'os-too-old': 'needs iOS 26 or later',
  'no-module': 'this build has no on-device bridge',
  'device-not-eligible': 'this device does not support Apple Intelligence',
  'model-not-ready': 'the model is still downloading',
};

export function aiAvailability() {
  try {
    if (mod) {
      const s = mod.availability();
      return {
        available: !!s.available,
        reason: REASONS[s.reason] || s.reason || 'unknown',
        backend: s.backend || 'none',
      };
    }
  } catch {
    // fall through to unavailable
  }
  return { available: false, reason: REASONS['no-module'], backend: 'none' };
}

/** Ask the on-device model. Resolves to null when it cannot answer. */
export async function askAi(prompt, instructions) {
  if (!mod) return null;
  try {
    const res = await mod.respond(prompt, instructions);
    return res && res.ok && res.text ? res.text : null;
  } catch {
    return null;
  }
}
