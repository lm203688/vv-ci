import type { ReactNode, JSX } from 'react';
import type { DuoLayout } from './duoLayout';

export function useDuoLayout(): DuoLayout;
export const useDuo: typeof useDuoLayout;
export function headerPad(layout: DuoLayout, extraRight?: number): { paddingTop: number; paddingRight: number };
export function bodyPad(
  layout: DuoLayout,
  base?: number
): { paddingLeft: number; paddingRight: number; paddingTop: number; paddingBottom: number };
export function DuoPanes(props: {
  layout: DuoLayout;
  left: ReactNode;
  right?: ReactNode;
  style?: any;
}): JSX.Element;
export function CardGrid(props: { layout: DuoLayout; children?: ReactNode; style?: any }): JSX.Element;
