import { useWindowDimensions } from 'react-native';

import { stageHeight, stageWidth } from '../actor/geometry';

const minWidth = 280;
// Share of the window height the stage may take, so the controls below stay reachable.
const maxHeightShare = 0.62;

// Size of the pet stage for the current window. It keeps the stage's proportions and fits both
// dimensions, so a wide window (iPad, a spanned Duo, an unfolded foldable) never pushes the floor off screen.
export function useStageSize() {
  const { width, height } = useWindowDimensions();
  const byWidth = Math.max(minWidth, width);
  const byHeight = Math.max(minWidth, (height * maxHeightShare * stageWidth) / stageHeight);
  const viewWidth = Math.min(byWidth, byHeight);
  return { viewWidth, viewHeight: viewWidth * (stageHeight / stageWidth), windowWidth: width };
}
