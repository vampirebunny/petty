import { useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { previewBackdrop } from '../../actor/previewScene';
import { FitScale } from '../../ui/FitScale';
import { useOpenedDuoTopInset } from '../../ui/useDeviceOrientation';
import { isLandscapeSplit, phoneColumnWidth } from '../../ui/wideLayout';

export type PreviewFrame = { width: number; height: number };

// Landscape tablet, spanned Duo, or unfolded foldable. Same split home uses for the pet and controls.
export function useAdoptLayout() {
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);
  const duoTop = useOpenedDuoTopInset();
  return { split, paddingTop: 56 + (split ? duoTop : 0) };
}

// Header across the top, pet preview on the left, phone-width controls on the right.
export function AdoptSplit({
  header,
  preview,
  children,
}: {
  header: ReactNode;
  preview: (frame: PreviewFrame | null) => ReactNode;
  children: ReactNode;
}) {
  const [frame, setFrame] = useState<PreviewFrame | null>(null);
  return (
    <View style={styles.splitRoot}>
      <View style={styles.headerRule}>{header}</View>
      <View style={styles.splitBody}>
        <View
          style={styles.stagePane}
          onLayout={(event) => {
            const width = Math.round(event.nativeEvent.layout.width);
            const height = Math.round(event.nativeEvent.layout.height);
            setFrame((prev) => (prev && prev.width === width && prev.height === height ? prev : { width, height }));
          }}
        >
          {preview(frame)}
        </View>
        <FitScale designWidth={phoneColumnWidth} style={styles.controlColumn}>
          {children}
        </FitScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splitRoot: {
    flex: 1,
  },
  headerRule: {
    paddingHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D0D8E3',
  },
  splitBody: {
    flex: 1,
    flexDirection: 'row',
  },
  stagePane: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: previewBackdrop,
  },
  controlColumn: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: phoneColumnWidth,
    maxWidth: phoneColumnWidth,
    minWidth: 0,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: '#F4F7FB',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#D0D8E3',
  },
});
