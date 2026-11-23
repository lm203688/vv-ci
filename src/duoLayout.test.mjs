import test from 'node:test';
import assert from 'node:assert/strict';
import {
  layoutForSize,
  canSplitDetail,
  columnsForWidth,
  clampContent,
  WIDE_MIN,
  TWO_PANE_MIN,
  DUO_RIGHT_GUTTER,
  DUO_INNER_RIGHT_GUTTER,
} from './duoLayout.js';

// Real geometry measured from the iOS 27.1 iPhone Duo simulator:
//   outer (closed) screenshot 1398x2034 px @3x  = 466x678 pt
//   inner (open)   screenshot 2007x2853 px @3x  = 951x669 pt (landscape, framebuffer stored rotated)
const DUO_INNER = [951, 669];
const DUO_OUTER = [466, 678];

test('Duo outer display stays a stacked layout but still clears the right status capsule', () => {
  const l = layoutForSize(DUO_OUTER[0], DUO_OUTER[1]);
  assert.equal(l.wide, false);
  assert.equal(l.mode, 'stack');
  assert.equal(l.columns, 1);
  assert.equal(l.duoShaped, true);
  assert.equal(l.gutter, DUO_RIGHT_GUTTER, 'outer capsule sits on the right edge');
  assert.ok(l.topInset <= 30, 'no tall phone inset on Duo');
});

test('Duo inner display fills the screen, splits into two panes, and clears the wider capsule panel', () => {
  const l = layoutForSize(DUO_INNER[0], DUO_INNER[1]);
  assert.equal(l.wide, true);
  assert.equal(l.mode, 'split');
  assert.equal(l.duoShaped, true);
  assert.equal(l.duoInner, true);
  // The inner capsule panel eats ~78pt measured from the screenshot, so the gutter is 80.
  assert.equal(l.gutter, DUO_INNER_RIGHT_GUTTER, 'inner capsule panel is wider than the outer capsule');
  assert.ok(l.gutter > DUO_RIGHT_GUTTER);
  assert.equal(l.left + l.right, 951);
  assert.ok(l.left >= 360 && l.left <= 400, 'list pane stays readable: ' + l.left);
  assert.ok(l.right > l.left, 'working pane is wider than the list pane: ' + l.right);
  assert.ok(l.contentMaxWidth >= 900, 'content spans the whole inner display');
});

test('a normal iPhone portrait keeps the classic phone layout', () => {
  for (const [w, h] of [[402, 874], [440, 956], [390, 844]]) {
    const l = layoutForSize(w, h);
    assert.equal(l.wide, false);
    assert.equal(l.duoShaped, false);
    assert.equal(l.gutter, 0);
    assert.equal(l.topInset, 58);
    assert.equal(l.columns, 1);
  }
});

test('a phone in landscape is not a Duo either', () => {
  for (const [w, h] of [[874, 402], [956, 440], [844, 390]]) {
    const l = layoutForSize(w, h);
    assert.equal(l.duoShaped, false, w + 'x' + h + ' is a rotated phone');
    assert.equal(l.gutter, 34);
  }
});

test('an iPad is never treated as a Duo, in either orientation', () => {
  // Tablet portrait is 1.4-1.5 h/w, which sits inside the Duo outer aspect band on purpose:
  // width and height bounds are what keep a tablet from reserving a capsule gutter it has no capsule for.
  const tablets = [
    [834, 1194], // 11" portrait
    [820, 1180], // 10th gen portrait (measured on the simulator)
    [1024, 1366],
    [768, 1024],
    [1180, 820], // 10th gen landscape
    [1133, 744], // iPad mini landscape, the narrowest tablet landscape
    [1366, 1024],
  ];
  for (const [w, h] of tablets) {
    const l = layoutForSize(w, h);
    assert.equal(l.duoShaped, false, w + 'x' + h + ' is a tablet, not a Duo');
    assert.equal(l.duoInner, false, w + 'x' + h);
    assert.equal(l.gutter, 34, 'tablets get the plain wide gutter');
    assert.equal(l.topInset, 24, 'tablets keep the wide inset, not the Duo inset');
  }
});

test('card columns', () => {
  assert.equal(columnsForWidth(1024), 3);
  assert.equal(columnsForWidth(834), 2);
  assert.equal(columnsForWidth(669), 2);
  assert.equal(columnsForWidth(540), 1);
  assert.equal(columnsForWidth(466), 1);
  assert.equal(columnsForWidth(402), 1);
});

test('thresholds are ordered and sane', () => {
  assert.ok(WIDE_MIN < TWO_PANE_MIN);
  assert.equal(canSplitDetail(WIDE_MIN), false);
  assert.equal(canSplitDetail(TWO_PANE_MIN), true);
  assert.equal(canSplitDetail(DUO_INNER[0]), true, 'Duo inner display can host a split detail');
});

test('robust against missing dimensions', () => {
  const l = layoutForSize(undefined, undefined);
  assert.equal(l.width, 390);
  assert.equal(l.height, 844);
  assert.equal(l.mode, 'stack');
  assert.equal(l.duoShaped, false);
  assert.equal(clampContent(2000), 1180);
  assert.equal(clampContent(700), 700);
});
