import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import type { RunwayThemeId } from '../../runway/catalog';
import {
  themeSkyColor,
  venueFx,
  venueLayerLayout,
  venueStackHeight,
  venueTileWidth,
  venueXml,
} from '../../runway/venue';
import { createVenueFxRuntime, drawVenueBeams, drawVenueExtras, drawVenueLedChase } from './venueFx';

type Props = {
  themeId: RunwayThemeId;
  width: number;
  height: number;
  /** `contain` letterboxes the whole stack. `cover` fills the box from the top of the venue. */
  fit?: 'contain' | 'cover';
  radius?: number;
};

/** Static crop of the venue stack for the theme picker (no motion FX). */
export function ThemeStill({ themeId, width, height, fit = 'contain', radius = 14 }: Props) {
  const picture = useMemo(() => {
    const xml = venueXml(themeId);
    const fx = venueFx(themeId);
    const contain = Math.min(width / venueTileWidth, height / venueStackHeight);
    const cover = Math.max(width / venueTileWidth, height / venueStackHeight);
    const scale = fit === 'cover' ? cover : contain;
    const drawW = venueTileWidth * scale;
    const drawH = venueStackHeight * scale;
    const ox = (width - drawW) / 2;
    const oy = fit === 'cover' ? 0 : height - drawH;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
    const sky = Skia.Paint();
    sky.setColor(Skia.Color(themeSkyColor(themeId)));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), sky);

    const drawLayer = (index: number) => {
      const layout = venueLayerLayout[index];
      const layerXml = xml[index];
      if (!layout || !layerXml) {
        return;
      }
      const svg = Skia.SVG.MakeFromString(layerXml);
      if (!svg) {
        return;
      }
      canvas.save();
      canvas.translate(ox, oy + layout.y * scale);
      canvas.drawSvg(svg, drawW, layout.height * scale);
      canvas.restore();
    };

    const runtime = createVenueFxRuntime(fx);
    const fxOpts = {
      width,
      height,
      scale,
      stageTop: oy,
      scroll: 0,
      scrollDir: 1 as const,
      reducedMotion: true,
      fxEnabled: true,
      petCenterX: width / 2,
      dt: 0,
    };

    drawLayer(0);
    drawVenueExtras(canvas, fx, runtime, fxOpts);
    drawLayer(1);
    drawLayer(2);
    drawVenueBeams(canvas, fx, runtime, fxOpts);
    drawLayer(3);
    drawLayer(4);
    drawLayer(5);
    drawVenueLedChase(canvas, fx, runtime, fxOpts);
    drawLayer(6);

    return recorder.finishRecordingAsPicture();
  }, [fit, height, themeId, width]);

  return (
    <View style={[styles.frame, { width, height, borderRadius: radius, backgroundColor: themeSkyColor(themeId) }]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
});
