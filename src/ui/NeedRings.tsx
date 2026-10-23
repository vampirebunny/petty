import { Bone, Droplet, Heart, Zap } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Needs } from '../sim/types';
import { candyInk, tints } from './candy';
import type { TintName } from './candy';
import { fontFamily } from './font';
import { iconStroke } from './theme';

type Props = {
  needs: Needs;
  hydration: number;
};

// Geometry lives in a 100-unit box so the ring can grow with its column and still
// keep the stroke inside the edges. The value sits under the icon, so the ring
// is larger than the old icon-only disc.
const box = 100;
const stroke = 8;
const ringRadius = (box - stroke) / 2;
const circumference = 2 * Math.PI * ringRadius;
const iconSize = 22;

const lowThreshold = 25;
const alarmArc = '#D93A3F';
const alarmText = '#B42318';

type Tier = { min: number; text: string };
export type Need = {
  label: string;
  Icon: LucideIcon;
  tint: TintName;
  tiers: Tier[];
  noAlarm?: boolean;
  alarmBelow?: number;
};

const tummy: Need = {
  label: 'Tummy',
  Icon: Bone,
  tint: 'peach',
  alarmBelow: 30,
  tiers: [
    { min: 75, text: 'Yummy!' },
    { min: 50, text: 'Peckish' },
    { min: lowThreshold, text: 'Rumbly' },
    { min: 0, text: 'Starving!' },
  ],
};

const hydrationNeed: Need = {
  label: 'Hydration',
  Icon: Droplet,
  tint: 'aqua',
  tiers: [
    { min: 75, text: 'Full' },
    { min: 50, text: 'Sipping' },
    { min: lowThreshold, text: 'Thirsty' },
    { min: 0, text: 'Parched!' },
  ],
};

const energy: Need = {
  label: 'Energy',
  Icon: Zap,
  tint: 'butter',
  alarmBelow: 30,
  tiers: [
    { min: 75, text: 'Zoomy!' },
    { min: 50, text: 'Chill' },
    { min: lowThreshold, text: 'Sleepy' },
    { min: 0, text: 'Exhausted!' },
  ],
};

const mood: Need = {
  label: 'Mood',
  Icon: Heart,
  tint: 'pink',
  tiers: [
    { min: 75, text: 'Joyful!' },
    { min: 50, text: 'Content' },
    { min: lowThreshold, text: 'Meh' },
    { min: 0, text: 'Gloomy!' },
  ],
};

export function Ring({
  need,
  value,
  onPress,
  hint,
}: {
  need: Need;
  value: number;
  onPress?: () => void;
  hint?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const { label, Icon, tiers } = need;
  const tint = tints[need.tint];
  const alarm = clamped < (need.alarmBelow ?? lowThreshold) && !need.noAlarm;
  const caption = hint ?? (tiers.find((tier) => clamped >= tier.min) ?? tiers[tiers.length - 1]).text;
  const shown = Math.round(clamped);
  const ink = candyInk(tint);
  const labelText = `${label} ${shown} percent, ${caption.replace('!', '')}`;
  const body = (
    <View style={styles.face}>
      <View style={styles.ring}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${box} ${box}`}>
          <Circle
            cx={box / 2}
            cy={box / 2}
            r={ringRadius}
            stroke="rgba(255,255,255,0.9)"
            strokeWidth={stroke}
            fill="rgba(255,255,255,0.72)"
          />
          {clamped > 0 ? (
            <Circle
              cx={box / 2}
              cy={box / 2}
              r={ringRadius}
              stroke={alarm ? alarmArc : tint.icon}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={circumference * (1 - clamped / 100)}
              fill="none"
              transform={`rotate(-90 ${box / 2} ${box / 2})`}
            />
          ) : null}
        </Svg>
        <View style={styles.core}>
          <View style={styles.glyph}>
            <View style={styles.glyphShadow}>
              <Icon size={iconSize} strokeWidth={iconStroke + 1} color="#FFFFFF" />
            </View>
            <Icon size={iconSize} strokeWidth={iconStroke + 1} color={tint.icon} />
          </View>
          <Text style={[styles.value, { color: alarm ? alarmText : ink }]}>{shown}%</Text>
        </View>
        {alarm ? (
          <View style={styles.badge}>
            <Text style={styles.badgeMark}>!</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.status, { color: alarm ? alarmText : ink }, alarm && styles.statusAlarm]} numberOfLines={1}>
        {caption}
      </Text>
    </View>
  );
  if (!onPress) {
    return (
      <View style={styles.tile} accessible accessibilityLabel={labelText}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      style={styles.tile}
      accessible
      accessibilityRole="button"
      accessibilityLabel={labelText}
    >
      {body}
    </Pressable>
  );
}

export function NeedRings({ needs, hydration }: Props) {
  return (
    <View style={styles.row}>
      <Ring need={tummy} value={100 - needs.hunger} />
      <Ring need={hydrationNeed} value={hydration} />
      <Ring need={energy} value={needs.energy} />
      <Ring need={mood} value={needs.happiness} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
  },
  face: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 2,
    paddingHorizontal: 2,
  },
  ring: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 88,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  glyph: {
    width: iconSize,
    height: iconSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphShadow: {
    position: 'absolute',
    top: 1,
  },
  value: {
    fontFamily: fontFamily.black,
    fontSize: 14,
    lineHeight: 16,
  },
  label: {
    fontFamily: fontFamily.black,
    fontSize: 13,
  },
  status: {
    fontFamily: fontFamily.extraBold,
    fontSize: 11,
  },
  statusAlarm: {
    fontFamily: fontFamily.black,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C62A2F',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 13,
  },
});
