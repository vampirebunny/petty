import { useWindowDimensions } from 'react-native';

import { stageHeight, stageWidth } from '../actor/geometry';

const minWidth = 280;
// Share of the window height the stage may take, so the controls below stay reachable.
const maxHeightShare = 0.62;

// Size of the pet stage for the current window. Height stays within the stage's proportions.
// A wide window (iPad, a spanned Duo, an unfolded foldable) keeps that height and lets the
// caller paint the background out to the side edges.
export function useStageSize() {
  const { width, height } = useWindowDimensions();
  const byWidth = Math.max(minWidth, width);
  const byHeight = Math.max(minWidth, (height * maxHeightShare * stageWidth) / stageHeight);
  const contentWidth = Math.min(byWidth, byHeight);
  const viewHeight = contentWidth * (stageHeight / stageWidth);
  return { viewWidth: Math.max(contentWidth, width), viewHeight, contentWidth, windowWidth: width };
}
