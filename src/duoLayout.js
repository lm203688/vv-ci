// Duo / wide-screen layout primitives (pure, no React, no RN) — shared by all AppGallery apps.
// Testable with `node --test duoLayout.test.mjs`.

// Measured on the iOS 27.1 iPhone Duo simulator (simctl display list):
//   inner display 2007x2853 px @3x -> 669 x 951 pt
//   outer display 1398x2034 px @3x -> 466 x 678 pt
export const COMPACT_MAX = 519; // single column phone layout (Duo outer display)
export const WIDE_MIN = 520; // Duo inner display / landscape phone / iPad: fill the display
export const TWO_PANE_MIN = 640; // Duo inner display (669pt): list + detail side by side
export const XL_MIN = 980; // three card columns

// iOS 27.1 on Duo: the status bar moves to the right edge as a vertical capsule, so any
// Duo-shaped window keeps a right gutter (measured 46pt to clear the capsule) and a small
// top inset instead of the usual 58pt phone inset.
export const WIDE_RIGHT_GUTTER = 34;
export const DUO_RIGHT_GUTTER = 46; // covers both panels: outer capsule + inner vertical bar
export const WIDE_TOP_INSET = 24;
export const DUO_TOP_INSET = 20;
export const COMPACT_TOP_INSET = 58;
export const MAX_CONTENT_WIDTH = 1180;
// A normal iPhone portrait is ~2.17 h/w; Duo outer 678/466 = 1.46, inner 951/669 = 1.42.
export const DUO_ASPECT_MAX = 1.8;
export const DUO_MIN_WIDTH = 380;

export function layoutForSize(width, height) {
  const w = Number.isFinite(width) && width > 0 ? width : 390;
  const h = Number.isFinite(height) && height > 0 ? height : 844;
  const wide = w >= WIDE_MIN;
  const twoPane = w >= TWO_PANE_MIN;
  const extraWide = w >= XL_MIN;
  const columns = extraWide ? 3 : w >= 560 ? 2 : 1;
  const leftRatio = extraWide ? 0.36 : 0.4;
  const left = twoPane ? Math.min(520, Math.max(300, Math.round(w * leftRatio))) : 0;
  // Duo-shaped window (much squatter than a phone): its status capsule eats the right edge.
  const duoShaped = w >= DUO_MIN_WIDTH && h / w <= DUO_ASPECT_MAX;
  return {
    width: w,
    height: h,
    wide: wide,
    twoPane: twoPane,
    extraWide: extraWide,
    duoShaped: duoShaped,
    mode: twoPane ? 'split' : 'stack',
    columns: columns,
    left: left,
    right: twoPane ? Math.max(0, w - left) : 0,
    gutter: duoShaped ? DUO_RIGHT_GUTTER : wide ? WIDE_RIGHT_GUTTER : 0,
    topInset: duoShaped ? DUO_TOP_INSET : wide ? WIDE_TOP_INSET : COMPACT_TOP_INSET,
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
