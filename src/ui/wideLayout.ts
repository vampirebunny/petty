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

// Status icons on an opened Duo's right screen cover a Boop total parked at the screen edge.
export const openedDuoTopInset = 48;
export const openedDuoBoopEdge = 96;

export function looksSpannedDuo(width: number, height: number): boolean {
  const short = Math.min(width, height);
  const long = Math.max(width, height);
  // Spanned Duo is about 1100×720. This stays under an iPad mini (about 1133×744).
  return short >= 680 && short <= 740 && long >= 1040 && long <= 1160;
}

export function duoOpenedBoopEdge(os: string, width: number, height: number): number {
  // The wide landscape layout is the opened Duo. The model string on that device does not match,
  // and its window is a little under the spanned-size guess, so the name check never moved the total.
  return os === 'android' && isLandscapeSplit(width, height) ? openedDuoBoopEdge : 16;
}

export function duoOpenedTopInset(isDuo: boolean, width: number, height: number): number {
  return isDuo && isLargeWindow(width, height) ? openedDuoTopInset : 0;
}

// The control column is designed at phone width. A narrower column scales that layout down.
export function controlScale(columnWidth: number, design = phoneColumnWidth): number {
  if (columnWidth <= 0 || design <= 0) {
    return 1;
  }
  return Math.min(1, columnWidth / design);
}

// Fit the 640×680 stage in a box. Extra width is sky and floor; height follows the stage.
export function stageSizeFor(
  width: number,
  height: number,
  maxHeightShare = stackedHeightShare,
  frameW = stageWidth,
  frameH = stageHeight,
) {
  const byWidth = Math.max(minStageWidth, width);
  const byHeight = Math.max(minStageWidth, (height * maxHeightShare * frameW) / frameH);
  const contentWidth = Math.min(byWidth, byHeight);
  const viewHeight = contentWidth * (frameH / frameW);
  return { viewWidth: Math.max(contentWidth, width), viewHeight, contentWidth };
}
