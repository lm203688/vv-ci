import { requireNativeModule } from 'expo';

type VvSharedModule = {
  setWidgetData: (car: string, label: string, days: number) => boolean;
  clearWidgetData: () => boolean;
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
