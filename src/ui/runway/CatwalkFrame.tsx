import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { FitScale } from '../FitScale';
import { pageFill } from '../stadium/parts';
import { isLandscapeSplit, phoneColumnWidth } from '../wideLayout';

const stageFill = '#3E2F6E';

type Props = {
  art: ReactNode;
  /** Height of the art on a phone. Widescreen gives the art the whole left pane. */
  artHeight: number;
  /** Phone only: keep the art fixed and scroll the controls under it. Widescreen already pins the art. */
  stickyArt?: boolean;
  /** Stays above the scrolling controls. */
  dock?: ReactNode;
  /** Stays below the scrolling controls. */
  footer?: ReactNode;
  header: ReactNode;
  children: ReactNode;
  notices?: ReactNode;
};

export function CatwalkFrame({ art, artHeight, stickyArt = false, dock, footer, header, children, notices }: Props) {
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);

  if (split) {
    return (
      <View style={styles.root}>
        <View style={styles.split}>
          <View style={styles.stage}>{art}</View>
          <FitScale designWidth={phoneColumnWidth} style={styles.column}>
            <View style={styles.columnStack}>
              {dock}
              <ScrollView style={styles.columnScroll} contentContainerStyle={styles.columnContent} bounces={false}>
                {children}
              </ScrollView>
              {footer}
            </View>
          </FitScale>
        </View>
        {header}
        {notices}
      </View>
    );
  }

  const artPane = <View style={[styles.phoneArt, { height: artHeight }]}>{art}</View>;

  if (stickyArt) {
    return (
      <View style={styles.root}>
        {artPane}
        {dock}
        <ScrollView style={styles.stickyScroll} contentContainerStyle={styles.scroll} bounces={false}>
          <View style={styles.body}>{children}</View>
        </ScrollView>
        {footer}
        {header}
        {notices}
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        {artPane}
        <View style={styles.body}>{children}</View>
      </ScrollView>
      {header}
      {notices}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: pageFill },
  scroll: { paddingBottom: 36 },
  phoneArt: { width: '100%', backgroundColor: stageFill, overflow: 'hidden' },
  stickyScroll: { flex: 1 },
  body: { padding: 16, gap: 12 },
  split: { flex: 1, flexDirection: 'row' },
  stage: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    backgroundColor: stageFill,
  },
  column: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: phoneColumnWidth,
    maxWidth: phoneColumnWidth,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: pageFill,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E4D7F2',
  },
  columnStack: { flex: 1, minHeight: 0 },
  columnScroll: { flex: 1 },
  columnContent: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
});
