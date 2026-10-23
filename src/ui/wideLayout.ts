import { stageHeight, stageWidth } from '../actor/scenes';

// Short side of a tablet, spanned Duo, or unfolded foldable, in density-independent pixels.
export const largeShortSide = 600;
// Phones stay under about 450dp on the short side. A Surface Duo screen is about 540×720,
// and the opened wide posture is about 1114×720. Rotation starts here so one screen can turn
// before the window is large enough to split.
export const rotateShortSide = 520;
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

export function allowsDeviceRotation(width: number, height: number): boolean {
  return Math.min(width, height) >= rotateShortSide;
}

// A portrait lock letterboxes Surface Duo, so the measured window can stay one screen wide.
export function isSurfaceDuoModel(model: string, manufacturer = '', extra = ''): boolean {
  const name = `${manufacturer} ${model} ${extra}`;
  return /surface[ _-]?duo/i.test(name);
}

// Landscape on a tablet, spanned Duo, or unfolded foldable. Portrait stays stacked.
export function isLandscapeSplit(width: number, height: number): boolean {
  return isLargeWindow(width, height) && width > height;
}

// The control column is designed at phone width. A narrower column scales that layout down.
export function controlScale(columnWidth: number, design = phoneColumnWidth): number {
  if (columnWidth <= 0 || design <= 0) {
    return 1;
  }
  return Math.min(1, columnWidth / design);
}

// Fit the 640×680 stage in a box. Extra width is sky and floor; height follows the stage.
export function stageSizeFor(width: number, height: number, maxHeightShare = stackedHeightShare) {
  const byWidth = Math.max(minStageWidth, width);
  const byHeight = Math.max(minStageWidth, (height * maxHeightShare * stageWidth) / stageHeight);
  const contentWidth = Math.min(byWidth, byHeight);
  const viewHeight = contentWidth * (stageHeight / stageWidth);
  return { viewWidth: Math.max(contentWidth, width), viewHeight, contentWidth };
}
