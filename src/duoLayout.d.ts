export interface DuoLayout {
  width: number;
  height: number;
  wide: boolean;
  twoPane: boolean;
  extraWide: boolean;
  mode: 'split' | 'stack';
  columns: number;
  left: number;
  right: number;
  gutter: number;
  topInset: number;
  contentMaxWidth: number;
}

export function layoutForSize(width: number, height: number): DuoLayout;
export function canSplitDetail(width: number): boolean;
export function columnsForWidth(width: number): number;
export function clampContent(width: number, max?: number): number;

export const COMPACT_MAX: number;
export const WIDE_MIN: number;
export const TWO_PANE_MIN: number;
export const XL_MIN: number;
export const WIDE_RIGHT_GUTTER: number;
export const WIDE_TOP_INSET: number;
export const COMPACT_TOP_INSET: number;
export const MAX_CONTENT_WIDTH: number;
