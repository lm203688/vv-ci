import { requireNativeModule } from 'expo';

type VvSharedModule = {
  setWidgetData: (car: string, label: string, days: number) => boolean;
  clearWidgetData: () => boolean;
  liveActivityEnabled: () => boolean;
  startServiceActivity: (
    car: string,
    headline: string,
    detail: string,
    days: number
  ) => Promise<boolean>;
  endServiceActivity: () => Promise<boolean>;
};

let mod: VvSharedModule | null = null;
try {
  mod = requireNativeModule<VvSharedModule>('VvShared');
} catch (e) {
  mod = null;
}

export function setWidgetData(car: string, label: string, days: number): boolean {
  try {
    return mod ? mod.setWidgetData(car, label, days) : false;
  } catch (e) {
    return false;
  }
}

export function clearWidgetData(): boolean {
  try {
    return mod ? mod.clearWidgetData() : false;
  } catch (e) {
    return false;
  }
}

export function liveActivityEnabled(): boolean {
  try {
    return mod ? !!mod.liveActivityEnabled() : false;
  } catch (e) {
    return false;
  }
}

export async function startServiceActivity(
  car: string,
  headline: string,
  detail: string,
  days: number
): Promise<boolean> {
  try {
    return mod ? await mod.startServiceActivity(car, headline, detail, days) : false;
  } catch (e) {
    return false;
  }
}

export async function endServiceActivity(): Promise<boolean> {
  try {
    return mod ? await mod.endServiceActivity() : false;
  } catch (e) {
    return false;
  }
}
