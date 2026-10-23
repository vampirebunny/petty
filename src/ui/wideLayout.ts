import { stageHeight, stageWidth } from '../actor/scenes';

// Short side of a tablet, spanned Duo, or unfolded foldable, in density-independent pixels.
export const largeShortSide = 600;
// Home controls, and every other screen, stay about as wide as a phone.
export const phoneColumnWidth = 400;
// Share of the window height a stacked stage may take, so the controls below stay reachable.
export const stackedHeightShare = 0.62;

const minStageWidth = 280;

export type StageFrame = {
  width: number;
  height: number;
  /** 1 uses the full frame. Omitted on a measured pane means the full pane. */
  maxHeightShare?: number;
};

export function isLargeWindow(width: number, height: number): boolean {
  return Math.min(width, height) >= largeShortSide;
}

// Landscape on a tablet, spanned Duo, or unfolded foldable. Portrait stays stacked.
export function isLandscapeSplit(width: number, height: number): boolean {
  return isLargeWindow(width, height) && width > height;
}

// Fit the 640×680 stage in a box. Extra width is sky and floor; height follows the stage.
export function stageSizeFor(width: number, height: number, maxHeightShare = stackedHeightShare) {
  const byWidth = Math.max(minStageWidth, width);
  const byHeight = Math.max(minStageWidth, (height * maxHeightShare * stageWidth) / stageHeight);
  const contentWidth = Math.min(byWidth, byHeight);
  const viewHeight = contentWidth * (stageHeight / stageWidth);
  return { viewWidth: Math.max(contentWidth, width), viewHeight, contentWidth };
}
