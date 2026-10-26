import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';

import { drawToyShape } from './skia/scenery';
import { ICON_RADIUS } from './shop/ItemArt';
import { fontFamily } from './font';
import { SheetDismiss } from './SheetDismiss';

export type ToyChoice = {
  id: string;
  label: string;
};

type Props = {
  toys: ToyChoice[];
  top: number;
  empty: string;
  selectedId?: string;
  onClose: () => void;
  onPick: (id: string) => void;
};

export function ToyCard({ toys, top, empty, selectedId, onClose, onPick }: Props) {
  return (
    <SheetDismiss top={top} label="Close toys" onClose={onClose}>
      <View style={styles.card}>
        <Text style={styles.title}>Toy Box</Text>
        {toys.length === 0 ? (
          <Text style={styles.empty}>{empty}</Text>
        ) : (
          <View style={styles.row}>
            {toys.map((toy) => (
              <Pressable
                key={toy.id}
                accessibilityRole="button"
                accessibilityLabel={toy.label}
                accessibilityState={{ selected: toy.id === selectedId }}
                onPress={() => onPick(toy.id)}
                style={[styles.toy, toy.id === selectedId ? styles.toyOn : null]}
              >
                <ToyGlyph kind={toy.id} />
                <Text style={styles.label}>{toy.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </SheetDismiss>
  );
}

function ToyGlyph({ kind }: { kind: string }) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 72, 72));
    const mid = 36;
    drawToyShape(canvas, kind, mid, mid, 72 * ICON_RADIUS, 0, 'icon');
    return recorder.finishRecordingAsPicture();
  }, [kind]);
  return (
    <Canvas style={styles.glyph}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
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
    borderRadius: 16,
    paddingVertical: 4,
  },
  toyOn: {
    backgroundColor: '#E7F3FF',
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
