import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { PROP_SCALE, type TrickPropType } from '../sim/trickProps';
import { drawTrickProp } from './skia/trickPropArt';
import { fontFamily } from './font';
import { BedThumb, bedThumbId } from './shop/BedThumb';
import { FurnitureIcon } from './shop/ItemArt';

export type StorageChoice = {
  id: string;
  label: string;
  kind: 'furniture' | 'prop';
  type?: string;
  sourceTrickId?: string;
  /** Shop sku, or the furniture kind when the piece has no sku. */
  sku?: string;
  plant?: 'catgrass' | 'flowers' | 'catnip';
  /** Owned, but this scene is not a place for it. */
  inactive?: boolean;
};

type Props = {
  items: StorageChoice[];
  empty: string;
  top: number;
  onClose: () => void;
  onPick: (item: StorageChoice) => void;
};

const GLYPH = 72;

const trickTypes: readonly TrickPropType[] = ['podium', 'tunnel', 'hurdle', 'cones', 'hoop'];

function isTrickType(value: string): value is TrickPropType {
  return (trickTypes as readonly string[]).includes(value);
}

export function StorageCard({ items, empty, top, onClose, onPick }: Props) {
  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel="Close storage" onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>Storage</Text>
        {items.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <View style={styles.row}>
            {items.map((item) => (
              <Pressable
                key={`${item.kind}:${item.id}`}
                accessibilityRole="button"
                accessibilityLabel={item.inactive ? `${item.label}, not for this room` : item.label}
                accessibilityState={{ disabled: item.inactive === true }}
                disabled={item.inactive === true}
                onPress={() => onPick(item)}
                style={[styles.choice, item.inactive ? styles.choiceInactive : null]}
              >
                <StorageGlyph item={item} />
                <Text style={[styles.label, item.inactive ? styles.labelInactive : null]} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function StorageGlyph({ item }: { item: StorageChoice }) {
  if (item.kind === 'prop' && item.type && isTrickType(item.type)) {
    return <TrickGlyph type={item.type} sourceTrickId={item.sourceTrickId ?? ''} />;
  }
  if (item.sku && bedThumbId(item.sku)) {
    return <BedThumb itemId={item.sku} size={GLYPH} />;
  }
  if (item.sku) {
    return <FurnitureIcon itemId={item.sku} size={GLYPH} plant={item.plant} />;
  }
  return <View style={styles.glyph} />;
}

const trickBounds: Record<TrickPropType, { x0: number; y0: number; x1: number; y1: number }> = {
  podium: { x0: -48, y0: -36, x1: 48, y1: 8 },
  tunnel: { x0: -66, y0: -40, x1: 66, y1: 10 },
  hurdle: { x0: -40, y0: -70, x1: 34, y1: 2 },
  hoop: { x0: -16, y0: -82, x1: 16, y1: 6 },
  cones: { x0: -72, y0: -36, x1: 72, y1: 2 },
};

function TrickGlyph({ type, sourceTrickId }: { type: TrickPropType; sourceTrickId: string }) {
  const picture = useMemo(() => {
    const raw = trickBounds[type];
    const bounds = {
      x0: raw.x0 * PROP_SCALE,
      y0: raw.y0 * PROP_SCALE,
      x1: raw.x1 * PROP_SCALE,
      y1: raw.y1 * PROP_SCALE,
    };
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, GLYPH, GLYPH));
    const pad = GLYPH * 0.08;
    const scale = Math.min((GLYPH - pad * 2) / (bounds.x1 - bounds.x0), (GLYPH - pad * 2) / (bounds.y1 - bounds.y0));
    canvas.save();
    canvas.translate(GLYPH / 2 - ((bounds.x0 + bounds.x1) / 2) * scale, GLYPH / 2 - ((bounds.y0 + bounds.y1) / 2) * scale);
    canvas.scale(scale, scale);
    const prop = { instanceId: 'icon', type, sourceTrickId, x: 0, y: 0, knocked: false };
    drawTrickProp(canvas, prop, 'back');
    drawTrickProp(canvas, prop, 'front');
    canvas.restore();
    return recorder.finishRecordingAsPicture();
  }, [sourceTrickId, type]);
  return (
    <Canvas style={styles.glyph}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 30,
    paddingHorizontal: 20,
  },
  dim: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    backgroundColor: '#FFF6FB',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: '#6B4C7A',
  },
  empty: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: '#6B4C7A',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  choice: {
    width: 96,
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingVertical: 4,
  },
  choiceInactive: {
    opacity: 0.38,
  },
  glyph: {
    width: GLYPH,
    height: GLYPH,
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: '#6B4C7A',
    textAlign: 'center',
  },
  labelInactive: {
    color: '#B7A3C4',
  },
});
