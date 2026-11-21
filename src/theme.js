// 语义色 + 8pt 间距 + 字号阶梯（依据 市场扫描\iOS原生体感设计规范-v1.md 第二、四节）
import { useColorScheme } from 'react-native';

export const light = {
  bg: '#F2F3EF',
  surface: '#FFFFFF',
  primary: '#22432D',
  accent: '#2F6B3C',
  text: '#1C1C1E',
  muted: '#6B7280',
  line: '#DFE3DB',
  overdue: '#B3261E',
  urgent: '#C77700',
  due: '#6B7A1F',
  ok: '#2F6B3C',
};

export const dark = {
  bg: '#101210',
  surface: '#1B1E1C',
  primary: '#8FCBA3',
  accent: '#6FBF88',
  text: '#F2F4F2',
  muted: '#A1A7A3',
  line: '#343A35',
  overdue: '#FF6B60',
  urgent: '#FFB74D',
  due: '#C7D46A',
  ok: '#7FD39A',
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const type = { title: 22, heading: 20, body: 17, sub: 15, caption: 13 };
export const touch = { min: 44 };

export function useTheme() {
  const scheme = useColorScheme();
  const c = scheme === 'dark' ? dark : light;
  return {
    c,
    s: spacing,
    t: type,
    statusLabel: { overdue: 'Overdue', urgent: 'Urgent', due: 'Due', ok: 'OK' },
    statusColor: { overdue: c.overdue, urgent: c.urgent, due: c.due, ok: c.ok },
  };
}
