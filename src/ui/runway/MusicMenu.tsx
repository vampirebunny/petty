import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, Pause, Play } from 'lucide-react-native';

import { runwayTracks, trackById } from '../../runway/catalog';
import { fontFamily } from '../font';
import { ink, softInk } from '../stadium/parts';
import { iconStroke } from '../theme';
import { SoundBars } from './SoundBars';

type Props = {
  trackId: string;
  previewId: string | null;
  onPreview: (id: string) => void;
  onSelect?: (id: string) => void;
  /** Set on a friend show: the track is already chosen. */
  lockedLabel?: string;
};

export function MusicMenu({ trackId, previewId, onPreview, onSelect, lockedLabel }: Props) {
  const [open, setOpen] = useState(false);
  const title = trackById(trackId)?.title ?? 'Show music';
  const playing = previewId === trackId;

  return (
    <View style={styles.wrap}>
      {lockedLabel ? <Text style={styles.kicker}>{lockedLabel}</Text> : <Text style={styles.kicker}>Show music</Text>}
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={playing ? `Pause ${title}` : `Preview ${title}`}
          onPress={() => onPreview(trackId)}
          style={styles.play}
        >
          {playing ? <Pause size={18} color={ink} strokeWidth={iconStroke} /> : <Play size={18} color={ink} strokeWidth={iconStroke} />}
        </Pressable>
        {onSelect ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Choose show music" onPress={() => setOpen((value) => !value)} style={styles.hit}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <ChevronDown size={18} color={softInk} strokeWidth={iconStroke} />
          </Pressable>
        ) : (
          <View style={styles.hit}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            {playing ? <SoundBars active color="#7853E6" /> : null}
          </View>
        )}
      </View>
      {open && onSelect ? (
        <View style={styles.menu}>
          {runwayTracks.map((track) => {
            const on = track.id === trackId;
            const rowPlaying = previewId === track.id;
            return (
              <View key={track.id} style={[styles.option, on && styles.optionOn]}>
                <Pressable accessibilityRole="button" accessibilityLabel={rowPlaying ? `Pause ${track.title}` : `Preview ${track.title}`} onPress={() => onPreview(track.id)} style={styles.play}>
                  {rowPlaying ? <Pause size={16} color={ink} strokeWidth={iconStroke} /> : <Play size={16} color={ink} strokeWidth={iconStroke} />}
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.hit} onPress={() => { onSelect(track.id); setOpen(false); }}>
                  <Text style={[styles.optionText, on && styles.optionTextOn]} numberOfLines={1}>{track.title}</Text>
                  {rowPlaying ? <SoundBars active color="#7853E6" /> : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  kicker: { fontFamily: fontFamily.semibold, fontSize: 13, color: softInk },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 8,
    paddingRight: 12,
  },
  play: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD3E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hit: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: ink },
  menu: { backgroundColor: '#FFFFFF', borderRadius: 18, overflow: 'hidden' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingRight: 12 },
  optionOn: { backgroundColor: '#EFE9FF' },
  optionText: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 15, color: ink },
  optionTextOn: { fontFamily: fontFamily.fredokaSemibold },
});
