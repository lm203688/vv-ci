// Duo / wide-screen layout primitives (pure, no React, no RN) — shared by all AppGallery apps.
// Testable with `node --test duoLayout.test.mjs`.

// Measured on the iOS 27.1 iPhone Duo simulator (simctl display list):
//   inner display 2007x2853 px @3x -> 669 x 951 pt
//   outer display 1398x2034 px @3x -> 466 x 678 pt
export const COMPACT_MAX = 519; // single column phone layout (Duo outer display)
export const WIDE_MIN = 520; // Duo inner display / landscape phone / iPad: fill the display
export const TWO_PANE_MIN = 640; // Duo inner display (669pt): list + detail side by side
export const XL_MIN = 980; // three card columns

// iOS 27.1 on Duo: the status bar becomes a vertical bar on the right edge, so wide
// layouts keep a right gutter and a much smaller top inset than a phone.
export const WIDE_RIGHT_GUTTER = 34;
export const WIDE_TOP_INSET = 24;
export const COMPACT_TOP_INSET = 58;
export const MAX_CONTENT_WIDTH = 1180;

export function layoutForSize(width, height) {
  const w = Number.isFinite(width) && width > 0 ? width : 390;
  const h = Number.isFinite(height) && height > 0 ? height : 844;
  const wide = w >= WIDE_MIN;
  const twoPane = w >= TWO_PANE_MIN;
  const extraWide = w >= XL_MIN;
  const columns = extraWide ? 3 : w >= 560 ? 2 : 1;
  const leftRatio = extraWide ? 0.36 : 0.4;
  const left = twoPane ? Math.min(520, Math.max(300, Math.round(w * leftRatio))) : 0;
  return {
    width: w,
    height: h,
    wide: wide,
    twoPane: twoPane,
    extraWide: extraWide,
    mode: twoPane ? 'split' : 'stack',
    columns: columns,
    left: left,
    right: twoPane ? Math.max(0, w - left) : 0,
    gutter: wide ? WIDE_RIGHT_GUTTER : 0,
    topInset: wide ? WIDE_TOP_INSET : COMPACT_TOP_INSET,
    contentMaxWidth: Math.min(MAX_CONTENT_WIDTH, w),
  };
}

// True when a detail screen has room for inputs beside the result panel.
export function canSplitDetail(width) {
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  return w >= TWO_PANE_MIN;
}

export function columnsForWidth(width) {
  const w = Number.isFinite(width) && width > 0 ? width : 390;
  if (w >= XL_MIN) return 3;
  if (w >= 560) return 2;
  return 1;
}

export function clampContent(width, max) {
  const w = Number.isFinite(width) && width > 0 ? width : 0;
  const m = Number.isFinite(max) && max > 0 ? max : MAX_CONTENT_WIDTH;
  return Math.min(w, m);
}
