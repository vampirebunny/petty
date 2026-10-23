import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { drawToyShape } from './skia/scenery';
import { fontFamily } from './font';

export type ToyChoice = {
  id: string;
  label: string;
};

type Props = {
  toys: ToyChoice[];
  top: number;
  empty: string;
  onClose: () => void;
  onPick: (id: string) => void;
};

export function ToyCard({ toys, top, empty, onClose, onPick }: Props) {
  return (
    <View style={[styles.layer, { top }]} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel="Close toys" onPress={onClose} />
      <View style={styles.card}>
        <Text style={styles.title}>Play</Text>
        {toys.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <View style={styles.row}>
            {toys.map((toy) => (
              <Pressable
                key={toy.id}
                accessibilityRole="button"
                accessibilityLabel={toy.label}
                onPress={() => onPick(toy.id)}
                style={styles.toy}
              >
                <ToyGlyph kind={toy.id} />
                <Text style={styles.label}>{toy.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function ToyGlyph({ kind }: { kind: string }) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 72, 72));
    drawToyShape(canvas, kind, 36, 40, 22);
    return recorder.finishRecordingAsPicture();
  }, [kind]);
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 12,
    shadowColor: '#5CA3EA',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 17,
    color: '#2A6FB8',
  },
  empty: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#173D66',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  toy: {
    width: 88,
    alignItems: 'center',
    gap: 4,
  },
  glyph: {
    width: 72,
    height: 72,
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#173D66',
    textAlign: 'center',
  },
});
