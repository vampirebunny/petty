import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';

import { playPointPop } from '../../audio/badge';
import { fontFamily } from '../font';
import { PrimaryButton } from './PrimaryButton';
import { ui, type RefreshAccent } from './tokens';

type ButtonSpec = {
  label: string;
  onPress: () => void;
  closeFirst?: boolean;
};

type Props = {
  title: string;
  body: string;
  icon: LucideIcon;
  accent?: RefreshAccent;
  primary: ButtonSpec;
  secondary?: ButtonSpec;
  item?: { name: string; count: string };
  reducedMotion: boolean;
  dismissible?: boolean;
  top?: number;
};

export function BoopModal({
  title,
  body,
  icon: Icon,
  accent = 'care',
  primary,
  secondary,
  item,
  reducedMotion,
  dismissible = true,
  top,
}: Props) {
  const tone = ui.accent[accent];
  const scale = useSharedValue(reducedMotion ? 1 : 0.92);
  const presence = useSharedValue(0);
  const afterClose = useRef<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (leaving) {
      presence.value = withTiming(0, { duration: reducedMotion ? 0 : 150 });
      const timer = setTimeout(() => afterClose.current?.(), reducedMotion ? 0 : 150);
      return () => clearTimeout(timer);
    }
    playPointPop();
    presence.value = withTiming(1, { duration: reducedMotion ? 0 : 150 });
    scale.value = reducedMotion ? 1 : withSpring(1, { damping: 14, stiffness: 180 });
  }, [leaving, presence, reducedMotion, scale]);
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const layerStyle = useAnimatedStyle(() => ({ opacity: presence.value }));
  const press = (action: () => void, closeFirst = false) => {
    if (leaving) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!closeFirst || reducedMotion) {
      action();
      return;
    }
    afterClose.current = action;
    setLeaving(true);
  };

  const card = (
    <Animated.View style={[styles.cardWrap, cardStyle]}>
      <View style={[styles.badge, { backgroundColor: tone.tint }]}>
        <Icon size={34} color={tone.main} strokeWidth={2} />
      </View>
      <View style={styles.edge} />
      <LinearGradient colors={[ui.card, ui.card, ui.modalSheen]} locations={[0, 0.55, 1]} style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {item ? (
          <View style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            <Text style={styles.itemCount}>{item.count}</Text>
          </View>
        ) : null}
        <PrimaryButton compact label={primary.label} reducedMotion={reducedMotion} onPress={() => press(primary.onPress, primary.closeFirst)} />
        {secondary ? (
          <Pressable accessibilityRole="button" onPress={() => press(secondary.onPress, secondary.closeFirst)} style={styles.secondary}>
            <Text style={styles.secondaryText}>{secondary.label}</Text>
          </Pressable>
        ) : null}
      </LinearGradient>
    </Animated.View>
  );

  return (
    <Animated.View style={[styles.layer, top != null && { top }, layerStyle]}>
      <ScrollView style={styles.fill} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" bounces={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          disabled={!dismissible}
          onPress={() => {
            if (secondary) {
              press(secondary.onPress, secondary.closeFirst);
            }
          }}
          style={StyleSheet.absoluteFill}
        />
        {card}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    backgroundColor: ui.scrim,
  },
  fill: {
    flex: 1,
  },
  // The badge sits 40pt above the card, so the top padding keeps it on screen when the card scrolls.
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 24,
    paddingBottom: 24,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    overflow: 'visible',
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 7,
    borderRadius: ui.radius.modal,
    backgroundColor: ui.modalEdge,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: ui.radius.modal,
    borderWidth: 3,
    borderColor: ui.card,
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    marginBottom: 7,
    alignItems: 'center',
  },
  badge: {
    zIndex: 2,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 5,
    borderColor: ui.card,
    marginBottom: -40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 24,
    color: ui.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.semibold,
    fontSize: 15,
    color: ui.disabledInk,
    textAlign: 'center',
  },
  item: {
    alignSelf: 'stretch',
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: ui.itemRow,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemName: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: ui.ink,
  },
  itemCount: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: ui.inkMuted,
  },
  secondary: {
    alignSelf: 'stretch',
    minHeight: 50,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.card,
    borderBottomWidth: 5,
    borderBottomColor: ui.cardEdge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 16,
    color: ui.disabledInk,
  },
});
