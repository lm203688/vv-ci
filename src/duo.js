import React, { useMemo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { layoutForSize } from './duoLayout.js';

// Hook: derive the Duo/wide layout from the live window size.
export function useDuoLayout() {
  const dims = useWindowDimensions();
  return useMemo(() => layoutForSize(dims.width, dims.height), [dims.width, dims.height]);
}

// Screens can call this directly (no provider threading needed).
export const useDuo = useDuoLayout;

// Header bars in these apps hard-code `paddingTop: 58` for the phone status bar.
// On Duo's inner display the status bar is vertical on the right, so we shrink the
// top inset and reserve a gutter on the right instead.
export function headerPad(layout, extraRight) {
  return {
    paddingTop: layout.topInset,
    paddingRight: 18 + layout.gutter + (extraRight || 0),
  };
}

// Screen body: fill the display, but never draw under the vertical status bar.
export function bodyPad(layout, base) {
  const b = base || 16;
  return {
    paddingLeft: b,
    paddingRight: b + layout.gutter,
    paddingTop: b,
    paddingBottom: b + 24,
  };
}

// Two panes side by side on iPad-class widths; a single column everywhere else.
export function DuoPanes(props) {
  const { layout, left, right, style } = props;
  if (!layout || !layout.twoPane || !right) {
    return <View style={[styles.fill, style]}>{left}</View>;
  }
  return (
    <View style={[styles.fill, styles.row, style]}>
      <View style={{ width: layout.left }}>{left}</View>
      <View style={{ width: layout.right, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#DFE5E2' }}>
        {right}
      </View>
    </View>
  );
}

// Grid wrapper for card lists: N columns when there is room, 1 otherwise.
export function CardGrid(props) {
  const { layout, children, style } = props;
  const columns = layout && layout.columns ? layout.columns : 1;
  if (columns <= 1) return <View style={style}>{children}</View>;
  const itemWidth = (100 / columns).toFixed(4) + '%';
  const items = React.Children.toArray(children).map((child, i) => (
    <View key={i} style={{ width: itemWidth, paddingRight: 8 }}>
      {child}
    </View>
  ));
  return <View style={[styles.row, { flexWrap: 'wrap' }, style]}>{items}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  row: { flexDirection: 'row' },
});
