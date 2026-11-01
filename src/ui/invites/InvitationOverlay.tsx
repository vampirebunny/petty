import { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import Svg, { Ellipse, Path, Polygon, Rect } from 'react-native-svg';

import { playBadgeChime } from '../../audio/badge';
import { serverNow } from '../../db/accountMeta';
import { inviteConfig } from '../../invites/config';
import type { Invitation } from '../../invites/types';
import { classLabel, eventLabel, formatCountdown, formatSlot } from '../../sim/stadium';
import { fontFamily } from '../font';
import { themePreview } from '../../runway/themePreviews';
import { themeBands } from './themeBands';

type Stage = 'closed' | 'opening' | 'reveal' | 'leaving';

type Props = {
  invitation: Invitation;
  reducedMotion: boolean;
  onDismiss: (method: 'button' | 'tap_outside') => void;
  onAccept: () => void;
  /** The race slot arrived. `opened` is false while the envelope is still closed. */
  onDue: (opened: boolean) => void;
  onOpened: () => void;
};

const spring = Easing.bezier(0.34, 1.56, 0.64, 1);

export function InvitationOverlay({ invitation, reducedMotion, onDismiss, onAccept, onDue, onOpened }: Props) {
  const [stage, setStage] = useState<Stage>('closed');
  const [now, setNow] = useState(() => serverNow());
  const opened = useRef(false);
  const dueFor = useRef<number | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDueRef = useRef(onDue);
  const [buttonsOn, setButtonsOn] = useState(false);

  const scale = useSharedValue(reducedMotion ? 1 : 0.4);
  const shrink = useSharedValue(1);
  const hold = useSharedValue(1);
  const wobble = useSharedValue(0);
  const flap = useSharedValue(0);
  const seal = useSharedValue(1);
  const peek = useSharedValue(0);
  const drop = useSharedValue(0);
  const card = useSharedValue(0);
  const buttons = useSharedValue(0);
  const pins = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useEffect(() => {
    onDueRef.current = onDue;
  }, [onDue]);

  useEffect(() => {
    playBadgeChime();
    if (reducedMotion) {
      return;
    }
    scale.value = withTiming(1, { duration: 550, easing: spring });
    wobble.value = withDelay(
      1100,
      withRepeat(
        withSequence(
          withTiming(-3, { duration: 220 }),
          withTiming(3, { duration: 220 }),
          withTiming(-2, { duration: 220 }),
          withTiming(0, { duration: 280 }),
          withTiming(0, { duration: 1860 }),
        ),
        -1,
        false,
      ),
    );
  }, [reducedMotion, scale, wobble]);

  useEffect(() => {
    const timer = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const dueAt = invitation.type === 'race' ? invitation.startsAt : invitation.expiresAt;
    if (now < dueAt || dueFor.current === dueAt) {
      return;
    }
    dueFor.current = dueAt;
    onDueRef.current(opened.current);
  }, [invitation, now]);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) {
        clearTimeout(leaveTimer.current);
      }
    };
  }, []);

  const open = () => {
    if (stage !== 'closed') {
      return;
    }
    opened.current = true;
    onOpened();
    hold.value = 0;
    setStage('opening');
    const handoff = reducedMotion ? 1 : inviteConfig.handoffMs;
    seal.value = withTiming(0, { duration: reducedMotion ? 1 : 220 });
    flap.value = withTiming(180, { duration: reducedMotion ? 1 : 420 });
    peek.value = withDelay(reducedMotion ? 0 : 320, withTiming(-28, { duration: reducedMotion ? 1 : 500, easing: spring }));
    setTimeout(() => {
      setStage('reveal');
      drop.value = withTiming(1, { duration: reducedMotion ? 1 : 500 });
      card.value = withDelay(reducedMotion ? 0 : 120, withTiming(1, { duration: reducedMotion ? 1 : 600, easing: spring }));
      buttons.value = withDelay(reducedMotion ? 0 : inviteConfig.buttonFadeMs, withTiming(1, { duration: reducedMotion ? 1 : 350 }));
      setTimeout(() => setButtonsOn(true), reducedMotion ? 1 : inviteConfig.buttonFadeMs);
      if (invitation.type === 'race') {
        pins.forEach((pin, index) => {
          pin.value = withDelay(reducedMotion ? 0 : 700 + index * 150, withTiming(1, { duration: reducedMotion ? 1 : 300, easing: spring }));
        });
      }
    }, handoff);
  };

  const leave = (method: 'button' | 'tap_outside') => {
    if (stage === 'leaving') {
      return;
    }
    setStage('leaving');
    card.value = withTiming(0, { duration: reducedMotion ? 1 : 400 });
    shrink.value = withTiming(0.6, { duration: reducedMotion ? 1 : 400 });
    leaveTimer.current = setTimeout(() => onDismiss(method), reducedMotion ? 1 : 400);
  };

  const envStyle = useAnimatedStyle(() => ({
    opacity: 1 - drop.value,
    transform: [
      { translateY: drop.value * 420 },
      { rotate: `${wobble.value * hold.value + drop.value * 10}deg` },
      { scale: scale.value * shrink.value },
    ],
  }));
  const flapStyle = useAnimatedStyle(() => ({
    // At 90° the lid is edge-on, so dropping it behind the card is invisible.
    zIndex: flap.value < 90 ? 6 : 0,
    transform: [{ perspective: 900 }, { rotateX: `${flap.value}deg` }],
  }));
  const sealStyle = useAnimatedStyle(() => ({
    opacity: seal.value,
    transform: [{ scale: 1 + (1 - seal.value) * 0.5 }],
  }));
  const peekStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: peek.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: card.value,
    transform: [{ translateY: (1 - card.value) * 140 }, { scale: 0.65 + card.value * 0.35 }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttons.value,
    transform: [{ translateY: (1 - buttons.value) * 12 }],
  }));

  const outside = () => {
    if (stage === 'leaving' || stage === 'opening') {
      return;
    }
    if (stage === 'closed') {
      open();
      return;
    }
    leave('tap_outside');
  };

  return (
    <View style={styles.fill} pointerEvents="box-none">
      <Pressable
        accessibilityLabel={stage === 'closed' ? 'Open invitation' : 'Dismiss invitation'}
        onPress={outside}
        style={styles.dim}
      />
      <View pointerEvents="box-none" style={styles.center}>
        {stage !== 'leaving' ? (
          <Animated.View style={envStyle} pointerEvents={stage === 'closed' ? 'auto' : 'none'}>
            <Pressable accessibilityRole="button" accessibilityLabel="Open invitation" onPress={open}>
              <Envelope invitation={invitation} flapStyle={flapStyle} sealStyle={sealStyle} peekStyle={peekStyle} />
            </Pressable>
          </Animated.View>
        ) : null}
        {stage === 'reveal' || stage === 'leaving' ? (
          <Animated.View style={[styles.cardWrap, cardStyle]}>
            {invitation.type === 'runway' ? (
              <RunwayCard invitation={invitation} />
            ) : (
              <RaceCard invitation={invitation} now={now} pins={pins} />
            )}
            <Animated.View style={[styles.buttons, buttonStyle]} pointerEvents={buttonsOn ? 'auto' : 'none'}>
              <Pressable accessibilityRole="button" onPress={onAccept} style={[styles.accept, invitation.type === 'race' && styles.acceptRace]}>
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => leave('button')} style={styles.later}>
                <Text style={[styles.laterText, invitation.type === 'race' && styles.laterRace]}>Maybe Next Time</Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

function Envelope({
  invitation,
  flapStyle,
  sealStyle,
  peekStyle,
}: {
  invitation: Invitation;
  flapStyle: object;
  sealStyle: object;
  peekStyle: object;
}) {
  return (
    <View style={styles.envelope}>
      <View style={styles.envelopeClip}>
        <View style={styles.envelopeBack} />
        <Animated.View style={[styles.peek, invitation.type === 'race' && styles.peekRace, peekStyle]}>
          {invitation.type === 'runway' ? (
            <Text style={styles.peekRunway}>THE CATWALK</Text>
          ) : (
            <Checker height={18} />
          )}
        </Animated.View>
        <Svg width={300} height={200} viewBox="0 0 300 200" style={styles.sidePockets}>
          <Polygon points="0,0 152,112 0,200" fill="#EFE0C6" />
          <Polygon points="300,0 148,112 300,200" fill="#EFE0C6" />
        </Svg>
        <Svg width={300} height={200} viewBox="0 0 300 200" style={styles.bottomPocket}>
          <Polygon points="0,200 150,96 300,200" fill="#F6EBD7" />
        </Svg>
        <View style={styles.label}>
          <Text style={styles.labelText}>{"You're invited!"}</Text>
        </View>
      </View>
      <Animated.View style={[styles.flap, flapStyle]}>
        <Svg width={300} height={122} viewBox="0 0 300 122">
          <Path d="M18 0 H282 Q300 0 290 12 L163 112 Q150 122 137 112 L10 12 Q0 0 18 0 Z" fill="#EADAB9" />
        </Svg>
        <Animated.View style={[styles.seal, sealStyle]}>
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Ellipse cx={15} cy={20} rx={7} ry={6} fill="#FFF3D6" />
            <Ellipse cx={6.5} cy={12.5} rx={3} ry={3.6} fill="#FFF3D6" />
            <Ellipse cx={11.5} cy={7.5} rx={3} ry={3.6} fill="#FFF3D6" />
            <Ellipse cx={18.5} cy={7.5} rx={3} ry={3.6} fill="#FFF3D6" />
            <Ellipse cx={23.5} cy={12.5} rx={3} ry={3.6} fill="#FFF3D6" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function RunwayCard({ invitation }: { invitation: Extract<Invitation, { type: 'runway' }> }) {
  const band = themeBands[invitation.themeId];
  const [artW, setArtW] = useState(0);
  return (
    <View style={styles.runway}>
      <Text style={styles.kicker}>THE CATWALK</Text>
      <Text style={styles.runwayTitle}>{"You're invited!"}</Text>
      <View
        style={styles.themePanel}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          setArtW((current) => (current === next ? current : next));
        }}
      >
        {artW > 0 && themePreview(invitation.themeId) ? (
          <Image source={themePreview(invitation.themeId)!} style={styles.themeArt} resizeMode="cover" />
        ) : (
          <View style={styles.themeArt} />
        )}
        <View style={[styles.themeBand, { backgroundColor: band.band }]}>
          <Text style={[styles.themeEyebrow, { color: band.eyebrow }]}>THEME</Text>
          <Text style={[styles.themeName, { color: band.name }]}>{invitation.themeName}</Text>
        </View>
      </View>
      <Text style={styles.looks}>Walk the runway in 3 looks</Text>
      <View style={styles.hangers}>
        <Hanger />
        <Hanger />
        <Hanger />
      </View>
    </View>
  );
}

function Hanger() {
  return (
    <Svg width={34} height={24} viewBox="0 0 34 24">
      <Path
        d="M17 8 V5 a3 3 0 1 1 3 -3 M17 8 L3 19 Q1 21 4 21 H30 Q33 21 31 19 Z"
        fill="none"
        stroke="#C2337F"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function RaceCard({
  invitation,
  now,
  pins,
}: {
  invitation: Extract<Invitation, { type: 'race' }>;
  now: number;
  pins: readonly SharedValue<number>[];
}) {
  const p1 = useAnimatedStyle(() => ({
    opacity: pins[0].value,
    transform: [{ scale: pins[0].value }, { rotate: '-28deg' }],
  }));
  const p2 = useAnimatedStyle(() => ({
    opacity: pins[1].value,
    transform: [{ scale: pins[1].value }, { rotate: '28deg' }],
  }));
  const p3 = useAnimatedStyle(() => ({
    opacity: pins[2].value,
    transform: [{ scale: pins[2].value }, { rotate: '28deg' }],
  }));
  const p4 = useAnimatedStyle(() => ({
    opacity: pins[3].value,
    transform: [{ scale: pins[3].value }, { rotate: '-28deg' }],
  }));
  return (
    <View style={styles.bib}>
      <Checker height={20} round />
      <Animated.View style={[styles.pin, styles.pin1, p1]}>
        <Pin />
      </Animated.View>
      <Animated.View style={[styles.pin, styles.pin2, p2]}>
        <Pin />
      </Animated.View>
      <Animated.View style={[styles.pin, styles.pin3, p3]}>
        <Pin />
      </Animated.View>
      <Animated.View style={[styles.pin, styles.pin4, p4]}>
        <Pin />
      </Animated.View>
      <Text style={styles.raceTitle}>{"You're invited!"}</Text>
      <Text style={styles.raceKicker}>STADIUM RACE</Text>
      <Text style={styles.bibNumber}>{invitation.bib}</Text>
      <View style={styles.eventBand}>
        <Text style={styles.eventText}>{eventLabel(invitation.event).toUpperCase()}</Text>
      </View>
      <Text style={styles.classLine}>{classLabel(invitation.classId)}</Text>
      <View style={styles.when}>
        <Text style={styles.whenText}>
          Starts in {formatCountdown(invitation.startsAt - now)} · {formatSlot(invitation.startsAt)}
        </Text>
      </View>
    </View>
  );
}

function Checker({ height, round = false }: { height: number; round?: boolean }) {
  return (
    <View style={[styles.checkerRow, { height }, round && styles.checkerRound]}>
      {Array.from({ length: 16 }, (_, index) => (
        <View key={index} style={[styles.checkerCell, index % 2 === 0 ? styles.checkerDark : styles.checkerLight]} />
      ))}
    </View>
  );
}

function Pin() {
  return (
    <Svg width={40} height={16} viewBox="0 0 40 16">
      <Path d="M7 8 H35 M7 12 H31" stroke="#8C95A8" strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Rect x={30} y={5} width={8} height={8} rx={2.5} fill="#8C95A8" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, zIndex: 40 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(38,16,54,0.55)' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cardWrap: { alignItems: 'center', gap: 26 },
  envelope: {
    width: 300,
    height: 200,
    overflow: 'visible',
    borderRadius: 18,
    backgroundColor: '#E3D1B2',
    shadowColor: '#1E0628',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 16 },
  },
  envelopeClip: { ...StyleSheet.absoluteFill, borderRadius: 18, overflow: 'hidden', zIndex: 1 },
  envelopeBack: { ...StyleSheet.absoluteFill, backgroundColor: '#E3D1B2' },
  peek: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 32,
    height: 156,
    backgroundColor: '#FFF6FB',
    borderRadius: 16,
    alignItems: 'center',
    paddingTop: 14,
    zIndex: 1,
    overflow: 'hidden',
  },
  peekRace: { backgroundColor: '#FFFDF7', paddingTop: 0, overflow: 'hidden' },
  peekRunway: { fontFamily: fontFamily.extraBold, fontSize: 11, letterSpacing: 2, color: '#8C3A72' },
  sidePockets: { position: 'absolute', left: 0, top: 0, zIndex: 1 },
  bottomPocket: { position: 'absolute', left: 0, top: 0, zIndex: 2 },
  flap: { position: 'absolute', left: 0, top: 0, width: 300, height: 130, overflow: 'visible', transformOrigin: 'center top' },
  seal: {
    position: 'absolute',
    left: 121,
    top: 77,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#C08A2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 7,
    zIndex: 3,
    shadowColor: '#D6C3A0',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 4 },
  },
  labelText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 20, color: '#3B3350' },
  checkerRow: { flexDirection: 'row', overflow: 'hidden', alignSelf: 'stretch' },
  checkerRound: { borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  checkerCell: { width: 20, height: '100%' },
  checkerDark: { backgroundColor: '#1E2A4A' },
  checkerLight: { backgroundColor: '#FFFFFF' },
  runway: {
    width: 300,
    backgroundColor: '#FFF6FB',
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 24,
    alignItems: 'center',
    gap: 14,
    borderWidth: 6,
    borderColor: '#F7CFE3',
  },
  kicker: { fontFamily: fontFamily.extraBold, fontSize: 12, letterSpacing: 2, color: '#8C3A72' },
  runwayTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 34, color: '#5B1F4A' },
  themePanel: { alignSelf: 'stretch', height: 168, borderRadius: 20, overflow: 'hidden' },
  themeArt: { height: 112, alignSelf: 'stretch' },
  themeBand: { height: 56, alignItems: 'center', justifyContent: 'center' },
  themeEyebrow: { fontFamily: fontFamily.extraBold, fontSize: 10, letterSpacing: 1 },
  themeName: { fontFamily: fontFamily.fredokaBold, fontSize: 16 },
  looks: { fontFamily: fontFamily.bold, fontSize: 17, color: '#5B1F4A' },
  hangers: { flexDirection: 'row', gap: 22 },
  bib: {
    width: 300,
    backgroundColor: '#FFFDF7',
    borderRadius: 22,
    alignItems: 'center',
    paddingBottom: 26,
    overflow: 'visible',
  },
  raceTitle: { marginTop: 18, fontFamily: fontFamily.fredokaBold, fontSize: 32, color: '#1E2A4A' },
  raceKicker: { fontFamily: fontFamily.extraBold, fontSize: 12, letterSpacing: 2, color: '#4A5578' },
  bibNumber: { fontFamily: fontFamily.fredokaBold, fontSize: 88, lineHeight: 92, color: '#1E2A4A' },
  eventBand: {
    alignSelf: 'stretch',
    marginHorizontal: 24,
    backgroundColor: '#E2552F',
    borderRadius: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  eventText: { fontFamily: fontFamily.fredokaBold, fontSize: 28, color: '#FFFFFF', letterSpacing: 1 },
  classLine: { fontFamily: fontFamily.extraBold, fontSize: 16, color: '#1E2A4A' },
  when: { backgroundColor: '#1E2A4A', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 10 },
  whenText: { fontFamily: fontFamily.extraBold, fontSize: 15, color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  pin: { position: 'absolute' },
  pin1: { left: 10, top: 28 },
  pin2: { right: 10, top: 28 },
  pin3: { left: 10, bottom: 16 },
  pin4: { right: 10, bottom: 16 },
  buttons: { width: 280, gap: 16 },
  accept: {
    height: 56,
    borderRadius: 999,
    backgroundColor: '#C2337F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8E1F5B',
    shadowOpacity: 1,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 6 },
  },
  acceptRace: { backgroundColor: '#26365F', shadowColor: '#121B33' },
  acceptText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 21, color: '#FFFFFF' },
  later: {
    height: 50,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: '#8E1F5B' },
  laterRace: { color: '#26365F' },
});
