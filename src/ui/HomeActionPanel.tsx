import { createElement, useEffect, useId, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Heart, Medal, PawPrint, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { iconFor } from './actionIcons';
import type { ActionSpecies } from './actionIcons';
import { CandyPlate, NeedFrame, PearlBubble } from './CandyPlate';
import { candyFlavors, candyLayout, panelWash, sprinkleColors, switchTrack } from './candyTokens';
import type { CandyFlavorName } from './candyTokens';
import { fontFamily } from './font';

export type CandyAction = {
  id: string;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  blocked?: boolean;
  sunk?: boolean;
  need?: string | null;
  switch?: boolean;
  checked?: boolean;
};

type PanelProps = {
  species: ActionSpecies;
  reducedMotion: boolean;
  care: CandyAction[];
  bond: CandyAction[];
  style: CandyAction[];
  tricks: { id: string; label: string; onPress: () => void; fresh: boolean }[];
  onProps?: () => void;
};

function candyIcon(id: string, species: ActionSpecies, size: number, color: string) {
  const Icon = iconFor(id, species);
  return Icon ? createElement(Icon, { size, color, strokeWidth: 2.3 }) : null;
}

const headerIcon = {
  care: Heart,
  bond: PawPrint,
  style: Sparkles,
  trick: Medal,
} as const;

export function HomeActionPanel({ species, reducedMotion, care, bond, style: styleActions, tricks, onProps }: PanelProps) {
  return (
    <View style={styles.panel}>
      <PanelWash />
      <Section flavor="care" title="Care" columns={4}>
        {care.map((action) => (
          <Tile key={action.id} action={action} flavor="care" species={species} reducedMotion={reducedMotion} />
        ))}
      </Section>
      <Section flavor="bond" title="Bond" columns={3}>
        {bond.map((action) => (
          <Tile key={action.id} action={action} flavor="bond" species={species} reducedMotion={reducedMotion} />
        ))}
      </Section>
      {tricks.length > 0 ? (
        <Section
          flavor="trick"
          title="Learned tricks"
          columns={4}
          fixed
          extra={
            onProps ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Prop" onPress={onProps} style={styles.propButton}>
                <Text style={[styles.headerText, { color: candyFlavors.trick.header }]}>Prop</Text>
              </Pressable>
            ) : null
          }
        >
          {tricks.map((trick) => (
            <Pop key={trick.id} fresh={trick.fresh && !reducedMotion}>
              <Tile
                action={{ id: trick.id, label: trick.label, onPress: trick.onPress }}
                flavor="trick"
                species={species}
                reducedMotion={reducedMotion}
              />
            </Pop>
          ))}
        </Section>
      ) : null}
      <Section flavor="style" title="Style & sound" columns={2} pill>
        {styleActions.map((action) => (
          <Pill key={action.id} action={action} species={species} />
        ))}
      </Section>
    </View>
  );
}

function PanelWash() {
  const uid = useId().replace(/:/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`wash${uid}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={panelWash[0]} />
            <Stop offset="0.5" stopColor={panelWash[1]} />
            <Stop offset="1" stopColor={panelWash[2]} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx="28" fill={`url(#wash${uid})`} />
      </Svg>
      {sprinkleColors.map((color, index) => (
        <View
          key={color}
          style={[
            styles.sprinkle,
            {
              backgroundColor: color,
              top: 18 + index * 36,
              left: index % 2 === 0 ? 12 : undefined,
              right: index % 2 === 1 ? 16 : undefined,
              transform: [{ rotate: `${-28 + index * 18}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function Section({
  flavor,
  title,
  columns,
  pill = false,
  fixed = false,
  icon,
  extra,
  children,
}: {
  flavor: 'care' | 'bond' | 'style' | 'trick';
  title: string;
  columns: number;
  pill?: boolean;
  fixed?: boolean;
  icon?: LucideIcon;
  extra?: ReactNode;
  children: ReactNode;
}) {
  const Icon = icon ?? headerIcon[flavor];
  const color = candyFlavors[flavor].header;
  const rows = chunk(toArray(children), columns);
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Icon size={16} color={color} fill={color} strokeWidth={2} />
        <Text style={[styles.headerText, { color }]}>{title}</Text>
        {extra}
      </View>
      <View style={[styles.rows, pill && styles.pillRows]}>
        {rows.map((row, index) => (
          <View key={index} style={styles.row}>
            {row.map((child, cell) => (
              <View key={cell} style={styles.cell}>
                {child}
              </View>
            ))}
            {fixed
              ? Array.from({ length: columns - row.length }, (_, pad) => <View key={`pad-${pad}`} style={styles.cell} />)
              : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function Tile({
  action,
  flavor,
  species,
  reducedMotion,
}: {
  action: CandyAction;
  flavor: CandyFlavorName;
  species: ActionSpecies;
  reducedMotion: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const tone = action.blocked ? 'muted' : flavor;
  const ink = candyFlavors[tone].icon;
  const label = candyFlavors[tone].label;
  const sunk = pressed || !!action.sunk;
  const body = (
    <CandyPlate flavor={tone} height={candyLayout.tileHeight} radius={candyLayout.tileRadius} pressed={sunk}>
      <View style={styles.tileBody}>
        <PearlBubble flavor={tone} size={candyLayout.bubble}>
          {candyIcon(action.id, species, candyLayout.icon, ink)}
        </PearlBubble>
        <Text style={[styles.tileLabel, { color: label }]} numberOfLines={2}>
          {action.label}
        </Text>
      </View>
    </CandyPlate>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      accessibilityState={{ disabled: !!action.blocked, selected: !!action.sunk }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onLongPress={action.onLongPress}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action.onPress();
      }}
    >
      {action.need && !action.blocked ? (
        <NeedFrame label={action.need} reducedMotion={reducedMotion}>
          {body}
        </NeedFrame>
      ) : (
        body
      )}
    </Pressable>
  );
}

function Pill({ action, species }: { action: CandyAction; species: ActionSpecies }) {
  const [pressed, setPressed] = useState(false);
  const tone = candyFlavors.style;
  const isSwitch = !!action.switch;
  return (
    <Pressable
      accessibilityRole={isSwitch ? 'switch' : 'button'}
      accessibilityLabel={action.label}
      accessibilityState={isSwitch ? { checked: !!action.checked } : undefined}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        action.onPress();
      }}
    >
      <CandyPlate flavor="style" height={candyLayout.pillHeight} radius={candyLayout.pillHeight / 2} pill pressed={pressed}>
        <View style={styles.pillBody}>
          <PearlBubble flavor="style" size={candyLayout.pillBubble}>
            {candyIcon(action.id, species, candyLayout.pillIcon, tone.icon)}
          </PearlBubble>
          <Text style={[styles.pillLabel, { color: tone.label }]} numberOfLines={1}>
            {action.label}
          </Text>
          {isSwitch ? <CandySwitch on={!!action.checked} /> : null}
        </View>
      </CandyPlate>
    </Pressable>
  );
}

function CandySwitch({ on }: { on: boolean }) {
  const uid = useId().replace(/:/g, '');
  return (
    <View style={[styles.track, { backgroundColor: on ? 'transparent' : switchTrack.off }]}>
      {on ? (
        <Svg width={switchTrack.width} height={switchTrack.height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={`sw${uid}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={switchTrack.on[0]} />
              <Stop offset="1" stopColor={switchTrack.on[1]} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={switchTrack.width} height={switchTrack.height} rx={12} fill={`url(#sw${uid})`} />
        </Svg>
      ) : null}
      <View style={[styles.knob, on ? styles.knobOn : styles.knobOff]} />
    </View>
  );
}

function Pop({ fresh, children }: { fresh: boolean; children: ReactNode }) {
  const scale = useSharedValue(fresh ? 0.6 : 1);
  useEffect(() => {
    if (!fresh) {
      return;
    }
    scale.value = withSequence(withTiming(1.1, { duration: 180 }), withTiming(1, { duration: 140 }));
  }, [fresh, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

function toArray(children: ReactNode): ReactNode[] {
  return Array.isArray(children) ? children : [children];
}

function chunk(items: ReactNode[], size: number): ReactNode[][] {
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += size) {
    rows.push(items.slice(index, index + size));
  }
  return rows;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 28,
    padding: 12,
    gap: candyLayout.sectionGap,
    overflow: 'hidden',
  },
  sprinkle: {
    position: 'absolute',
    width: 12,
    height: 4,
    borderRadius: 2,
    opacity: 0.85,
  },
  section: {
    gap: candyLayout.headerGap,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  propButton: {
    marginLeft: 'auto',
  },
  headerText: {
    fontSize: candyLayout.header,
    fontFamily: fontFamily.fredokaBold,
  },
  rows: {
    gap: candyLayout.gap,
  },
  pillRows: {
    gap: candyLayout.gap,
  },
  row: {
    flexDirection: 'row',
    gap: candyLayout.gap,
  },
  cell: {
    flex: 1,
  },
  tileBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  tileLabel: {
    fontSize: candyLayout.label,
    fontFamily: fontFamily.fredokaSemibold,
    textAlign: 'center',
  },
  pillBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  pillLabel: {
    flex: 1,
    fontSize: candyLayout.label,
    fontFamily: fontFamily.fredokaSemibold,
  },
  track: {
    width: switchTrack.width,
    height: switchTrack.height,
    borderRadius: switchTrack.height / 2,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    width: switchTrack.knob,
    height: switchTrack.knob,
    borderRadius: switchTrack.knob / 2,
    backgroundColor: '#FFFFFF',
    top: (switchTrack.height - switchTrack.knob) / 2,
  },
  knobOn: {
    left: switchTrack.width - switchTrack.knob - 3,
  },
  knobOff: {
    left: 3,
  },
});
