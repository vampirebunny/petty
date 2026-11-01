import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { RibbonGroup } from '../../awards/caseModel';
import { awardEventOf } from '../../awards/trophyArt';
import { classLabel, eventLabel } from '../../sim/stadium';
import type { RaceClass, RaceEvent } from '../../sim/stadium';
import { Ribbon, type RibbonClass, type RibbonPlacing } from '../awards';
import { fontFamily } from '../font';
import { caseTokens } from './tokens';

type Props = {
  groups: RibbonGroup[];
  onClose: () => void;
};

export function RibbonSheet({ groups, onClose }: Props) {
  return (
    <Modal transparent animationType="slide" visible onRequestClose={onClose}>
      <View style={styles.dim}>
        <View style={styles.card}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.closeHit}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Text style={styles.title}>Ribbons</Text>
          <ScrollView contentContainerStyle={styles.body}>
            {groups.map((row) => (
              <View key={`${row.event}-${row.classId}-${row.place}`} style={styles.row}>
                <Ribbon
                  placing={clampPlace(row.place)}
                  cls={ribbonClass(row.classId)}
                  event={ribbonEvent(row.event)}
                  size={72}
                />
                <View style={styles.copy}>
                  <Text style={styles.name}>{eventTitle(row.event)}</Text>
                  <Text style={styles.meta}>
                    {classTitle(row.classId)} · {placeLabel(row.place)}
                    {row.count > 1 ? ` · ×${row.count}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function clampPlace(place: number): RibbonPlacing {
  if (place === 2 || place === 3) {
    return place;
  }
  return 1;
}

function ribbonClass(classId: string): RibbonClass {
  if (
    classId === 'beginner' ||
    classId === 'novice' ||
    classId === 'open' ||
    classId === 'expert' ||
    classId === 'championship' ||
    classId === 'veteran'
  ) {
    return classId;
  }
  return 'none';
}

function ribbonEvent(event: string): Exclude<ReturnType<typeof awardEventOf>, 'none'> {
  const art = awardEventOf(event);
  return art === 'none' ? 'run' : art;
}

function eventTitle(event: string): string {
  return eventLabel(event as RaceEvent) || event;
}

function classTitle(classId: string): string {
  return classId ? classLabel(classId as RaceClass) : 'Open';
}

function placeLabel(place: number): string {
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  return '3rd';
}

const styles = StyleSheet.create({
  dim: {
    flex: 1,
    backgroundColor: 'rgba(42, 43, 74, 0.45)',
    justifyContent: 'flex-end',
  },
  card: {
    maxHeight: '80%',
    backgroundColor: caseTokens.cream,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 8,
  },
  closeHit: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
  },
  close: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: caseTokens.purple,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 22,
    color: caseTokens.ink,
  },
  body: {
    gap: 12,
    paddingBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: caseTokens.ink,
  },
  meta: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: caseTokens.muted,
  },
});
