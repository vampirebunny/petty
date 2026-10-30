import { gameplayConfig } from '../sim/gameplayConfig';

const luma = [0.299, 0.587, 0.114];

function row(scale: number, bias: number): number[] {
  return [scale * luma[0], scale * luma[1], scale * luma[2], 0, bias];
}

/** 4×5 color matrix. Skia reads the translation column in 0–1, not 0–255. */
export function clipGradeMatrix(night: boolean): number[] {
  const filter = gameplayConfig.petCam.filter;
  if (!night) {
    const contrast = filter.dayContrast;
    const bias = 0.5 - 0.5 * contrast;
    return [...row(contrast, bias), ...row(contrast, bias), ...row(contrast, bias), 0, 0, 0, 1, 0];
  }
  const dark = [0.04, 0.1, 0.05];
  const bright = [0.847, 1, 0.847];
  const channels: number[] = [];
  for (let channel = 0; channel < 3; channel += 1) {
    const span = bright[channel] - dark[channel];
    const scale = span * filter.nightGain;
    const bias = dark[channel] + span * filter.nightLift;
    channels.push(...row(scale, bias));
  }
  channels.push(0, 0, 0, 1, 0);
  return channels;
}
