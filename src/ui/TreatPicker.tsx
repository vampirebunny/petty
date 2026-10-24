import { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';

import { playPointPop } from '../audio/badge';
import { fontFamily } from './font';
import { ICON_RADIUS } from './shop/ItemArt';
import { drawTreatShape } from './skia/scenery';

type Choice = { id: string; name: string; count?: number | null };

type Props = {
  choices: Choice[];
  title?: string;
  emptyLabel?: string;
  closeLabel?: string;
  note?: string | null;
  species?: 'dog' | 'cat' | null;
  // When set, the sheet starts at this offset so the pet preview above it stays visible.
  top?: number;
  onPick: (id: string) => void;
  onClose: () => void;
};

export function TreatPicker({
  choices,
  title = 'Pantry',
  emptyLabel = 'No treats available.',
  closeLabel = 'Close pantry',
  note,
  species = null,
  top,
  onPick,
  onClose,
}: Props) {
  const empty = choices.length === 0;
  useEffect(() => {
    playPointPop();
  }, []);
  const press = (action: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    action();
  };

  return (
    <View style={[styles.layer, top != null ? { top } : styles.centered]} pointerEvents="box-none">
      <Pressable style={styles.dim} accessibilityLabel={closeLabel} onPress={() => press(onClose)} />
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        {note ? <Text style={styles.note}>{note}</Text> : null}
        {empty ? (
          <Text style={styles.empty}>{emptyLabel}</Text>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.row}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {choices.map((choice) => (
              <Pressable
                key={choice.id}
                accessibilityRole="button"
                accessibilityLabel={choice.count == null ? choice.name : `${choice.name}, ${choice.count}`}
                onPress={() => press(() => onPick(choice.id))}
                style={({ pressed }) => [styles.treat, pressed && styles.treatOn]}
              >
                <View>
                  <TreatGlyph id={choice.id} species={species} />
                  {choice.count == null ? null : (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{choice.count}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.label}>{choice.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function TreatGlyph({ id, species }: { id: string; species: 'dog' | 'cat' | null }) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, 72, 72));
    const mid = 36;
    drawTreatShape(canvas, id, mid, mid, 72 * ICON_RADIUS, 0, species, 'icon');
    return recorder.finishRecordingAsPicture();
  }, [id, species]);
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
  centered: {
    top: 0,
    justifyContent: 'center',
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
  note: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#173D66',
  },
  empty: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#173D66',
  },
  scroll: {
    maxHeight: 280,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  treat: {
    width: 88,
    alignItems: 'center',
    gap: 4,
    borderRadius: 16,
    paddingVertical: 4,
  },
  treatOn: {
    backgroundColor: '#E7F3FF',
  },
  glyph: {
    width: 72,
    height: 72,
  },
  count: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2A6FB8',
  },
  countText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 12,
    color: '#FFFFFF',
  },
  label: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#173D66',
    textAlign: 'center',
  },
});
