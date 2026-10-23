import { stageHeight, stageWidth } from '../../actor/scenes';
import {
  allowsDeviceRotation,
  isLandscapeSplit,
  isSurfaceDuoModel,
  phoneColumnWidth,
  stageSizeFor,
  stackedHeightShare,
} from '../wideLayout';

describe('isLandscapeSplit', () => {
  it('is on only for a large landscape window', () => {
    expect(isLandscapeSplit(390, 844)).toBe(false);
    expect(isLandscapeSplit(844, 390)).toBe(false);
    expect(isLandscapeSplit(834, 1194)).toBe(false);
    expect(isLandscapeSplit(1194, 834)).toBe(true);
    expect(isLandscapeSplit(540, 720)).toBe(false);
    expect(isLandscapeSplit(1114, 720)).toBe(true);
    expect(isLandscapeSplit(720, 1114)).toBe(false);
  });
});

describe('allowsDeviceRotation', () => {
  it('lets a Duo screen rotate before the window is wide enough to split', () => {
    expect(allowsDeviceRotation(390, 844)).toBe(false);
    expect(allowsDeviceRotation(540, 720)).toBe(true);
    expect(allowsDeviceRotation(1114, 720)).toBe(true);
  });
});

describe('isSurfaceDuoModel', () => {
  it('matches Surface Duo and not other phones', () => {
    expect(isSurfaceDuoModel('Surface Duo', 'Microsoft')).toBe(true);
    expect(isSurfaceDuoModel('Surface Duo 2', 'Microsoft')).toBe(true);
    expect(isSurfaceDuoModel('Pixel 7', 'Google')).toBe(false);
    expect(isSurfaceDuoModel('Galaxy Z Fold5', 'samsung')).toBe(false);
  });
});

describe('stageSizeFor', () => {
  it('keeps a stacked stage within the height share and bleeds a wider window', () => {
    const width = 834;
    const height = 1194;
    const sized = stageSizeFor(width, height, stackedHeightShare);
    const cap = height * stackedHeightShare;
    expect(sized.viewHeight).toBeCloseTo(cap, 5);
    expect(sized.viewWidth).toBe(width);
    expect(sized.contentWidth).toBeCloseTo((cap * stageWidth) / stageHeight, 5);
  });

  it('fills a landscape pane by its shorter side', () => {
    const paneW = 1194 - phoneColumnWidth;
    const paneH = 700;
    const sized = stageSizeFor(paneW, paneH, 1);
    expect(sized.viewWidth).toBe(paneW);
    expect(sized.viewHeight).toBeCloseTo(paneH, 5);
    expect(sized.contentWidth / stageWidth).toBeCloseTo(sized.viewHeight / stageHeight, 5);
  });
});
