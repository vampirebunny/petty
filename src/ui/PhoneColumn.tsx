import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { isLandscapeSplit, phoneColumnWidth } from './wideLayout';

const ContentWidthContext = createContext<number | null>(null);

// Width layout math should use. Inside a phone column this is the column; otherwise the window.
export function useContentWidth(): number {
  const limited = useContext(ContentWidthContext);
  const { width } = useWindowDimensions();
  return limited ?? width;
}

export function useLimitedContentWidth(): number | null {
  return useContext(ContentWidthContext);
}

// On a landscape tablet, Duo, or foldable, keep one phone-width column in the middle.
// The frame behind it fills the window. Phones and portrait tablets render the child as-is.
export function PhoneColumn({ children, backgroundColor }: { children: ReactNode; backgroundColor?: string }) {
  const { width, height } = useWindowDimensions();
  if (!isLandscapeSplit(width, height)) {
    return children;
  }
  const column = Math.min(phoneColumnWidth, width);
  return (
    <View style={[styles.frame, backgroundColor != null ? { backgroundColor } : null]}>
      <ContentWidthContext.Provider value={column}>
        <View style={[styles.column, { width: column }]}>{children}</View>
      </ContentWidthContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F4F7FB',
  },
  column: {
    flex: 1,
  },
});
