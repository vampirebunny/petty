import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import type { RunwayThemeId } from '../../runway/catalog';
import { themeSkyColor, venueLayerLayout, venueStackHeight, venueTileWidth, venueXml } from '../../runway/venue';

type Props = {
  themeId: RunwayThemeId;
  width: number;
  height: number;
};

/** Static crop of the venue stack for the theme picker. */
export function ThemeStill({ themeId, width, height }: Props) {
  const picture = useMemo(() => {
    const xml = venueXml(themeId);
    const scale = Math.min(width / venueTileWidth, height / venueStackHeight);
    const drawW = venueTileWidth * scale;
    const drawH = venueStackHeight * scale;
    const ox = (width - drawW) / 2;
    const oy = height - drawH;
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, Math.max(width, 1), Math.max(height, 1)));
    const sky = Skia.Paint();
    sky.setColor(Skia.Color(themeSkyColor(themeId)));
    canvas.drawRect(Skia.XYWHRect(0, 0, width, height), sky);
    xml.forEach((layerXml, index) => {
      const layout = venueLayerLayout[index];
      if (!layout) {
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
    });
    return recorder.finishRecordingAsPicture();
  }, [height, themeId, width]);

  return (
    <View style={[styles.frame, { width, height, backgroundColor: themeSkyColor(themeId) }]}>
      <Canvas style={{ width, height }} pointerEvents="none">
        <Picture picture={picture} />
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', borderRadius: 14 },
});
