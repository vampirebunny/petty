import { useWindowDimensions } from 'react-native';

import { useLimitedContentWidth } from './PhoneColumn';
import { stackedHeightShare, stageSizeFor } from './wideLayout';
import type { StageFrame } from './wideLayout';

// Size of the pet stage. A stacked layout caps height so the controls below stay reachable
// and lets a wide window paint the background out to the side edges. A measured frame (the
// landscape scene pane) may use its full height. Inside a phone column, width is that column.
export function useStageSize(frame?: StageFrame, art?: { w: number; h: number }) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const limited = useLimitedContentWidth();
  const width = frame?.width ?? limited ?? windowWidth;
  const height = frame?.height ?? windowHeight;
  const share = frame?.maxHeightShare ?? (frame ? 1 : stackedHeightShare);
  return { ...stageSizeFor(width, height, share, art?.w, art?.h), windowWidth: width };
}
