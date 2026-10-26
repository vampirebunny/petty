import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { Canvas, Picture, Skia } from '@shopify/react-native-skia';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Bone, RotateCcw, Store } from 'lucide-react-native';

import { playPointPop } from '../audio/badge';
import { fontFamily } from './font';
import { drawTreatShape } from './skia/scenery';

type Primary = {
  label: string;
  onPress: () => void;
  tone: 'butter' | 'lilac' | 'sky';
  icon?: 'bone' | 'retry' | 'shop';
  badge?: string;
};

type Props = {
  header: 'success' | 'miss' | 'break';
  title: string;
  body: string;
  reducedMotion: boolean;
  top?: number;
  progress?: { label: string; detail: string; fill: number; color: string };
  remain?: { label: string; fraction: number };
  wind?: { owned: number; species: 'dog' | 'cat' | null };
  primary?: Primary;
  secondary: { label: string; onPress: () => void; closeFirst?: boolean };
};

const HEADER = 78;

export function TrainingSheet({
  header,
  title,
  body,
  reducedMotion,
  top,
  progress,
  remain,
  wind,
  primary,
  secondary,
}: Props) {
  const scale = useSharedValue(reducedMotion ? 1 : 0.86);
  const presence = useSharedValue(1);
  const afterClose = useRef<(() => void) | null>(null);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    playPointPop();
    scale.value = reducedMotion ? 1 : withSpring(1, { damping: 12, stiffness: 180 });
  }, [reducedMotion, scale]);
  useEffect(() => {
    if (!leaving) {
      return;
    }
    presence.value = withTiming(0, { duration: 180 });
    const timer = setTimeout(() => afterClose.current?.(), 180);
    return () => clearTimeout(timer);
  }, [leaving, presence]);
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
  const ink = header === 'miss' ? '#3D2A86' : header === 'break' ? '#1B2A6B' : '#5C3A12';
  const treatAside = header === 'break' && wind != null;
  const card = (
    <Animated.View style={[styles.card, cardStyle]}>
      <View style={styles.face}>
        {treatAside ? null : (
          <View style={[styles.banner, header === 'miss' ? styles.bannerMiss : header === 'break' ? styles.bannerBreak : styles.bannerGood]}>
            {header === 'break' && remain ? <RestRing label={remain.label} fraction={remain.fraction} /> : <PawBanner tone={header === 'miss' ? 'miss' : 'good'} />}
          </View>
        )}
        <Text style={[styles.title, { color: ink }]} numberOfLines={1}>
          {title}
        </Text>
        {treatAside && wind ? (
          <View style={styles.breakRow}>
            <WindArt species={wind.species} size={112} />
            <View style={styles.breakCopy}>
              {remain ? <Text style={styles.remainLine}>{remain.label} until practice</Text> : null}
              <Text style={[styles.body, styles.bodyAside, { color: ink }]}>{body}</Text>
              <Text style={styles.windName}>Second Wind</Text>
              <Text style={styles.ownedText}>You have {wind.owned}</Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.body, { color: ink }]} numberOfLines={2}>
            {body}
          </Text>
        )}
        {progress ? (
          <View style={styles.progress}>
            <View style={styles.progressTop}>
              <Text style={[styles.progressLabel, { color: ink }]} numberOfLines={1}>
                {progress.label}
              </Text>
              <Text style={[styles.progressDetail, { color: progress.color }]} numberOfLines={1}>
                {progress.detail}
              </Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, progress.fill))}%`, backgroundColor: progress.color }]} />
            </View>
          </View>
        ) : null}
        {wind && !treatAside ? <WindRow owned={wind.owned} species={wind.species} hot={wind.owned > 0} /> : null}
        {primary ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => press(primary.onPress)}
            style={({ pressed }) => [styles.hit, pressed && styles.squish]}
          >
            <View style={[styles.primary, primary.tone === 'lilac' ? styles.primaryLilac : primary.tone === 'sky' ? styles.primarySky : styles.primaryButter]}>
              <View style={styles.primaryMain}>
                <PrimaryIcon name={primary.icon} light={primary.tone !== 'butter'} />
                <Text style={[styles.primaryText, primary.tone === 'butter' ? styles.primaryTextDark : null]}>{primary.label}</Text>
              </View>
              {primary.badge ? (
                <View style={styles.badge}>
                  <Text style={[styles.badgeText, primary.tone === 'butter' ? styles.primaryTextDark : null]}>{primary.badge}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => press(secondary.onPress, secondary.closeFirst)}
          style={({ pressed }) => [pressed && styles.squish]}
        >
          <Text style={[styles.link, { color: ink }]}>{secondary.label}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
  return (
    <Animated.View style={[styles.layer, top != null && styles.below, top != null && { top }, layerStyle]} pointerEvents="box-none">
      <View style={styles.dim} />
      {top != null ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {card}
        </ScrollView>
      ) : (
        card
      )}
    </Animated.View>
  );
}

function PrimaryIcon({ name, light }: { name?: Primary['icon']; light: boolean }) {
  if (!name) {
    return null;
  }
  const color = light ? '#FFFFFF' : '#5A3A08';
  if (name === 'bone') {
    return <Bone size={16} color={color} strokeWidth={2.4} />;
  }
  if (name === 'shop') {
    return <Store size={16} color={color} strokeWidth={2.4} />;
  }
  return <RotateCcw size={16} color={color} strokeWidth={2.4} />;
}

function PawBanner({ tone }: { tone: 'good' | 'miss' }) {
  const paw = tone === 'miss' ? '#7B5CFF' : '#F27BA8';
  return (
    <View style={styles.bannerArt}>
      {tone === 'good' ? <Sunburst /> : <SoundArcs />}
      <View style={styles.pawDisc}>
        <Svg width={34} height={34} viewBox="0 0 36 36">
          <Ellipse cx="8" cy="14" rx="3.3" ry="4.3" fill={paw} />
          <Ellipse cx="14.2" cy="8.2" rx="3.3" ry="4.5" fill={paw} />
          <Ellipse cx="21.8" cy="8.2" rx="3.3" ry="4.5" fill={paw} />
          <Ellipse cx="28" cy="14" rx="3.3" ry="4.3" fill={paw} />
          <Path d="M18 17.5c5.2 0 9.2 3 9.2 6.8 0 2.8-3.8 5.2-9.2 5.2s-9.2-2.4-9.2-5.2c0-3.8 4-6.8 9.2-6.8z" fill={paw} />
        </Svg>
      </View>
    </View>
  );
}

function Sunburst() {
  return (
    <Svg width={160} height={HEADER} viewBox="0 0 160 78" style={styles.burst}>
      {Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        const x2 = 80 + Math.cos(angle) * 90;
        const y2 = 39 + Math.sin(angle) * 90;
        return <Path key={index} d={`M80 39 L${x2} ${y2}`} stroke="#FFD56A" strokeWidth={10} />;
      })}
    </Svg>
  );
}

function SoundArcs() {
  return (
    <Svg width={54} height={40} viewBox="0 0 54 40" style={styles.arcs}>
      <Path d="M8 8c8 6 8 18 0 24" stroke="#B7A4F2" strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d="M16 4c12 8 12 24 0 32" stroke="#CDBFF6" strokeWidth={3} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function RestRing({ label, fraction }: { label: string; fraction: number }) {
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const shown = Math.max(0, Math.min(1, fraction));
  return (
    <View style={styles.ringWrap}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#D5E8FA" strokeWidth={stroke} fill="#FFFFFF" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#3D8BFF"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={circ * (1 - shown)}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.ringLabel}>
        <Text style={styles.ringTime}>{label}</Text>
        <Text style={styles.ringHint}>UNTIL PRACTICE</Text>
      </View>
    </View>
  );
}

function WindRow({ owned, species, hot }: { owned: number; species: 'dog' | 'cat' | null; hot: boolean }) {
  return (
    <View style={[styles.wind, hot ? styles.windHot : null]}>
      <WindArt species={species} size={44} />
      <View style={styles.windCopy}>
        <Text style={styles.windName}>Second Wind</Text>
        <Text style={styles.ownedText}>You have {owned}</Text>
      </View>
    </View>
  );
}

function WindArt({ species, size }: { species: 'dog' | 'cat' | null; size: number }) {
  const picture = useMemo(() => {
    const recorder = Skia.PictureRecorder();
    const canvas = recorder.beginRecording(Skia.XYWHRect(0, 0, size, size));
    drawTreatShape(canvas, 'second_wind', size / 2, size / 2, size * 0.42, 0, species, 'icon');
    return recorder.finishRecordingAsPicture();
  }, [size, species]);
  return (
    <Canvas style={{ width: size, height: size }}>
      <Picture picture={picture} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 60,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  below: {
    justifyContent: 'flex-start',
    paddingTop: 8,
  },
  scroll: {
    alignSelf: 'stretch',
    flex: 1,
    maxWidth: 360,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(36, 48, 68, 0.4)',
  },
  card: {
    width: '100%',
    maxWidth: 360,
  },
  face: {
    backgroundColor: '#FFF8EF',
    borderRadius: 28,
    paddingTop: 10,
    paddingHorizontal: 12,
    paddingBottom: 6,
    gap: 6,
  },
  banner: {
    height: HEADER,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bannerGood: { backgroundColor: '#FFE59A' },
  bannerMiss: { backgroundColor: '#E6DCFF' },
  bannerBreak: { backgroundColor: '#E5F2FF' },
  bannerArt: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  burst: {
    position: 'absolute',
  },
  arcs: {
    position: 'absolute',
    right: 28,
  },
  pawDisc: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    position: 'absolute',
    alignItems: 'center',
  },
  ringTime: {
    fontFamily: fontFamily.black,
    fontSize: 13,
    color: '#1B2A6B',
  },
  ringHint: {
    fontFamily: fontFamily.extraBold,
    fontSize: 6,
    letterSpacing: 0.3,
    color: '#3D8BFF',
  },
  title: {
    fontFamily: fontFamily.black,
    fontSize: 20,
    textAlign: 'center',
  },
  body: {
    fontFamily: fontFamily.extraBold,
    fontSize: 13,
    lineHeight: 16,
    textAlign: 'center',
  },
  bodyAside: {
    textAlign: 'left',
  },
  breakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  breakCopy: {
    flex: 1,
    gap: 2,
  },
  remainLine: {
    fontFamily: fontFamily.black,
    fontSize: 13,
    color: '#3D8BFF',
  },
  progress: {
    gap: 4,
  },
  progressTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressLabel: {
    flex: 1,
    fontFamily: fontFamily.extraBold,
    fontSize: 12,
  },
  progressDetail: {
    fontFamily: fontFamily.black,
    fontSize: 12,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7E1D6',
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  wind: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F4F6FA',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  windHot: {
    backgroundColor: '#FFF3D6',
  },
  ownedText: {
    fontFamily: fontFamily.black,
    fontSize: 12,
    color: '#5C6B80',
  },
  windCopy: {
    flex: 1,
    gap: 1,
  },
  windName: {
    fontFamily: fontFamily.black,
    fontSize: 15,
    color: '#5C3A12',
  },
  hit: {
    alignSelf: 'stretch',
  },
  squish: {
    transform: [{ scale: 0.97 }],
  },
  primary: {
    minHeight: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButter: { backgroundColor: '#F6B429' },
  primaryLilac: { backgroundColor: '#7B5CFF' },
  primarySky: { backgroundColor: '#3D8BFF' },
  primaryMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryText: {
    fontFamily: fontFamily.black,
    fontSize: 15,
    color: '#FFFFFF',
  },
  primaryTextDark: {
    color: '#5A3A08',
  },
  badge: {
    position: 'absolute',
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fontFamily.black,
    fontSize: 11,
    color: '#FFFFFF',
  },
  link: {
    fontFamily: fontFamily.extraBold,
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 2,
  },
});
