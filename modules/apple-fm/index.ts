import { requireNativeModule } from 'expo';

type AppleFMModuleShape = {
  availability: () => { available: boolean; reason: string; backend: string };
  respond: (prompt: string, instructions?: string) => Promise<{ ok: boolean; text?: string; error?: string }>;
};

let mod: AppleFMModuleShape | null = null;
try {
  mod = requireNativeModule<AppleFMModuleShape>('AppleFM');
} catch {
  mod = null;
}

/** True when Apple Intelligence can answer on this device right now. */
export function aiAvailability(): { available: boolean; reason: string; backend: string } {
  try {
    if (mod) return mod.availability();
  } catch {
    // fall through
  }
  return { available: false, reason: 'no-module', backend: 'none' };
}

/** Ask the on-device model. Resolves to a plain string, or null when unavailable. */
export async function askAi(prompt: string, instructions?: string): Promise<string | null> {
  if (!mod) return null;
  try {
    const res = await mod.respond(prompt, instructions);
    return res && res.ok && res.text ? res.text : null;
  } catch {
    return null;
  }
}
