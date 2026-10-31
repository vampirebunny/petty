import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ChevronLeft, PawPrint } from 'lucide-react-native';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import type { Foliage } from '../../actor/sky';
import type { RoadSpot } from '../../sim/road';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { useContentWidth } from '../PhoneColumn';
import { isLandscapeSplit } from '../wideLayout';
import { useOpenedDuoTopInset } from '../useDeviceOrientation';
import { TownPlace } from './buildings';
import { PondGlint, TownCloud, TownGround } from './mapArt';
import { HomeRoomSheet } from './HomeRoomSheet';
import { buildingById, layoutFor, type Building, type PlaceBox, type Point } from './map';
import { townLook, useTownSky } from './townSky';
import { homeRooms } from './rooms';
import {
  legsBetween,
  legsFromProgress,
  pointAlong,
  progressOnLegs,
  routeLength,
  trace,
  tripSeconds,
  type Leg,
} from './route';
import { TownPet } from './TownPet';

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  roadSpot: RoadSpot;
  reducedMotion: boolean;
  onStand: (spot: RoadSpot) => void;
  onEnter: (sceneId: 'park' | 'school' | 'livingroom' | 'bedroom' | 'catio') => void;
  onShop: () => void;
  onArcade: () => void;
  onStadium: () => void;
};

type Outing = {
  origin: RoadSpot;
  dest: RoadSpot;
  legs: Leg[];
  points: Point[];
};

const petW = 96;
const petH = 72;
const maxMapWidth = 600;

export function TownScreen({ pet, species, roadSpot, reducedMotion, onStand, onEnter, onShop, onArcade, onStadium }: Props) {
  const contentWidth = useContentWidth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const wide = isLandscapeSplit(windowWidth, windowHeight);
  const layout = layoutFor(wide);
  const duoTop = useOpenedDuoTopInset();
  const [paneWidth, setPaneWidth] = useState(0);
  const mapW = wide ? paneWidth || windowWidth : Math.min(maxMapWidth, contentWidth);
  const scale = mapW / layout.width;
  const mapH = layout.height * scale;
  const rooms = homeRooms(species);
  const { sky, now } = useTownSky(reducedMotion);
  const { paint, chrome } = townLook(sky);
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const revealed = useRef(false);
  const outingRef = useRef<Outing | null>(null);
  const token = useRef(0);
  const [outing, setOuting] = useState<Outing | null>(null);
  const [along, setAlong] = useState(0);
  const [spot, setSpot] = useState<Point>(layout.nodes[roadSpot]);
  const [face, setFace] = useState<1 | -1>(1);
  const [sheet, setSheet] = useState(false);
  const [leaving, setLeaving] = useState<RoadSpot | null>(null);
  const pulse = useSharedValue(0);
  const spotRef = useRef(roadSpot);
  const reducedRef = useRef(reducedMotion);
  const scaleRef = useRef(scale);
  const layoutRef = useRef(layout);
  const seenLayout = useRef(layout.id);
  const progressRef = useRef(0);
  const frameRef = useRef(0);
  const actions = useRef({ onStand, onEnter, onShop, onArcade, onStadium });
  const leavingRef = useRef(false);

  const scrollToPet = (y: number) => {
    const view = viewport.current;
    if (view <= 0) {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - view * 0.45), animated: false });
  };

  useEffect(() => {
    actions.current = { onStand, onEnter, onShop, onArcade, onStadium };
  }, [onArcade, onEnter, onShop, onStadium, onStand]);

  useEffect(() => {
    if (!leaving) {
      return;
    }
    const dest = leaving;
    const frame = requestAnimationFrame(() => {
      const actionsNow = actions.current;
      if (dest === 'petShop') {
        actionsNow.onShop();
        return;
      }
      if (dest === 'arcade') {
        actionsNow.onArcade();
        return;
      }
      if (dest === 'stadium') {
        actionsNow.onStadium();
        return;
      }
      if (dest === 'park') {
        actionsNow.onEnter('park');
        return;
      }
      if (dest === 'trainingSchool') {
        actionsNow.onEnter('school');
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [leaving]);

  useEffect(() => {
    layoutRef.current = layout;
    scaleRef.current = scale;
    spotRef.current = roadSpot;
    reducedRef.current = reducedMotion;
    if (seenLayout.current !== layout.id) {
      seenLayout.current = layout.id;
      token.current += 1;
      cancelAnimationFrame(frameRef.current);
      outingRef.current = null;
      setOuting(null);
      setAlong(0);
      const next = layout.nodes[roadSpot];
      setSpot(next);
      scrollToPet(next.y * scale);
      return;
    }
    if (!outingRef.current) {
      setSpot(layout.nodes[roadSpot]);
    }
  }, [layout, reducedMotion, roadSpot, scale]);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const syncProgress = (value: number, previous: number) => {
    setAlong(value);
    const current = outingRef.current;
    if (!current) {
      return;
    }
    const before = pointAlong(current.points, previous);
    const after = pointAlong(current.points, value);
    setSpot(after);
    if (after.x - before.x > 0.4) {
      setFace(1);
    } else if (before.x - after.x > 0.4) {
      setFace(-1);
    }
    scrollToPet(after.y * scaleRef.current);
  };

  const finish = (dest: RoadSpot) => {
    if (leavingRef.current) {
      return;
    }
    cancelAnimationFrame(frameRef.current);
    outingRef.current = null;
    setOuting(null);
    setSpot(layoutRef.current.nodes[dest]);
    setAlong(0);
    const actionsNow = actions.current;
    if (dest === 'home') {
      actionsNow.onStand('home');
      setSheet(true);
      return;
    }
    // Drop the town pet's canvas before the place mounts its own. Swapping them
    // in one frame frees a picture the canvas is still drawing.
    leavingRef.current = true;
    setLeaving(dest);
  };

  const arrive = (dest: RoadSpot) => {
    finish(dest);
  };

  const play = (next: Outing) => {
    const id = token.current;
    outingRef.current = next;
    setOuting(next);
    setSheet(false);
    progressRef.current = 0;
    setAlong(0);
    setSpot(next.points[0] ?? layoutRef.current.nodes[next.origin]);
    const seconds = reducedRef.current ? 0 : tripSeconds(routeLength(next.legs));
    if (seconds <= 0) {
      progressRef.current = 1;
      arrive(next.dest);
      return;
    }
    // The clock starts when a door is tapped, not during render.
    // eslint-disable-next-line react-hooks/purity
    const started = Date.now();
    const tick = () => {
      if (id !== token.current) {
        return;
      }
      const value = Math.min(1, (Date.now() - started) / (seconds * 1000));
      const previous = progressRef.current;
      progressRef.current = value;
      syncProgress(value, previous);
      if (value >= 1) {
        arrive(next.dest);
        return;
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
  };

  const tap = (dest: RoadSpot) => {
    const current = outingRef.current;
    const graph = layoutRef.current.edges;
    if (!current && dest === spotRef.current) {
      arrive(dest);
      return;
    }
    if (current && current.dest === dest) {
      token.current += 1;
      cancelAnimationFrame(frameRef.current);
      progressRef.current = 1;
      arrive(dest);
      return;
    }
    let legs: Leg[] = [];
    let origin = spotRef.current;
    if (current) {
      origin = current.origin;
      const at = progressOnLegs(current.legs, progressRef.current);
      token.current += 1;
      cancelAnimationFrame(frameRef.current);
      legs = at ? legsFromProgress(at.edge, at.t, dest, graph) : legsBetween(spotRef.current, dest, graph);
    } else {
      legs = legsBetween(spotRef.current, dest, graph);
    }
    if (legs.length === 0) {
      arrive(dest);
      return;
    }
    play({ origin, dest, legs, points: trace(legs) });
  };

  const stopWalk = () => {
    const current = outingRef.current;
    if (!current) {
      return;
    }
    token.current += 1;
    cancelAnimationFrame(frameRef.current);
    outingRef.current = null;
    setOuting(null);
    setAlong(0);
    setSpot(layoutRef.current.nodes[current.origin]);
    actions.current.onStand(current.origin);
  };

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 0.7 + pulse.value * 0.6 }],
  }));

  const destNode = outing ? layout.nodes[outing.dest] : null;
  const dots = outing
    ? outing.points.filter((_, index) => index >= Math.floor(along * Math.max(0, outing.points.length - 1)) && index % 3 === 0)
    : [];
  const depth = 0.9 + 0.1 * Math.max(0, Math.min(1, spot.y / layout.height));
  const grown = scale > 1.2 ? scale : 1;
  const shownPetW = petW * grown;
  const shownPetH = petH * grown;
  const labelSize = (wide ? 16 : 15) * (grown > 1 ? grown : 1);

  return (
    <View style={[styles.root, { paddingTop: 64 + duoTop, backgroundColor: chrome.header }]}>
      <View style={[styles.header, wide && styles.headerWide]}>
        {outing ? <BackButton onPress={stopWalk} /> : null}
        <View style={[styles.titles, wide && styles.titlesWide]}>
          <Text style={[styles.title, wide && styles.titleWide, { color: chrome.title }]}>Boop Boop Town</Text>
          <Text style={[styles.subtitle, wide && styles.subtitleWide, { color: chrome.sub }]}>Pick a spot for {pet.name}</Text>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={[styles.scroll, { backgroundColor: paint.ground }]}
        contentContainerStyle={styles.scrollContent}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          viewport.current = height;
          if (wide) {
            const next = Math.round(width);
            setPaneWidth((prev) => (prev === next ? prev : next));
          }
          if (!revealed.current) {
            revealed.current = true;
            scrollToPet(layoutRef.current.nodes[spotRef.current].y * scaleRef.current);
          }
        }}
      >
        <View style={{ width: mapW, height: mapH }}>
          <View style={[styles.map, { width: mapW, height: mapH, backgroundColor: paint.ground }]}>
            <TownGround
              layout={layout}
              paint={paint}
              chrome={chrome}
              now={now}
              reducedMotion={reducedMotion}
              rainbow={sky.weather.rainbow}
              wind={sky.weather.wind}
            />
            <PondGlint layout={layout} scale={scale} reducedMotion={reducedMotion} />
            {dots.length > 0 ? (
              <Svg width={mapW} height={mapH} viewBox={`0 0 ${layout.width} ${layout.height}`} style={StyleSheet.absoluteFill}>
                {dots.map((dot, index) => (
                  <Circle key={`${dot.x}-${dot.y}-${index}`} cx={dot.x} cy={dot.y} r={3.2} fill="#F59AC9" />
                ))}
              </Svg>
            ) : null}
            {layout.clouds.map((cloud) => (
              <TownCloud
                key={`${cloud.y}-${cloud.duration}`}
                cloud={cloud}
                scale={scale}
                mapWidth={layout.width}
                reducedMotion={reducedMotion}
                fill={chrome.cloud}
                alpha={chrome.cloudAlpha}
              />
            ))}
            <PlaceArt
              box={layout.catwalk}
              scale={scale}
              labelSize={labelSize}
              reducedMotion={reducedMotion}
              night={chrome.night}
              snow={chrome.snow}
              foliage={paint.foliage}
              pill={chrome.pill}
              pillText={chrome.pillText}
            />
            {layout.buildings.map((building) => (
              <Door
                key={building.id}
                building={building}
                scale={scale}
                labelSize={labelSize}
                reducedMotion={reducedMotion}
                night={chrome.night}
                snow={chrome.snow}
                foliage={paint.foliage}
                pill={chrome.pill}
                pillText={chrome.pillText}
                onPress={() => tap(building.id)}
              />
            ))}
            {destNode ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulse,
                  pulseStyle,
                  {
                    left: destNode.x * scale - 28,
                    top: destNode.y * scale - 8,
                  },
                ]}
              />
            ) : null}
            <View
              pointerEvents="none"
              style={[
                styles.pet,
                {
                  left: spot.x * scale - shownPetW / 2,
                  top: spot.y * scale - shownPetH + 8 * grown,
                  width: shownPetW,
                  height: shownPetH,
                  transform: [{ scale: depth }],
                },
              ]}
            >
              {leaving ? null : (
                <TownPet
                  pet={pet}
                  walking={outing != null}
                  face={face}
                  reducedMotion={reducedMotion}
                  width={shownPetW}
                  height={shownPetH}
                />
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      {outing ? (
        <View style={styles.walkDock} pointerEvents="box-none">
          <View style={styles.walkPill}>
            <PawPrint size={18} color="#F59AC9" strokeWidth={2.4} />
            <Text style={styles.walkText}>Walking to the {buildingById(layout, outing.dest).name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => tap(outing.dest)} hitSlop={8}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {sheet ? (
        <HomeRoomSheet
          rooms={rooms}
          reducedMotion={reducedMotion}
          onClose={() => setSheet(false)}
          onPick={(id) => {
            setSheet(false);
            onEnter(id);
          }}
        />
      ) : null}
    </View>
  );
}

function PlaceArt({
  box,
  scale,
  labelSize,
  reducedMotion,
  night,
  snow,
  foliage,
  pill,
  pillText,
  name = 'The Catwalk',
}: {
  box: PlaceBox;
  scale: number;
  labelSize: number;
  reducedMotion: boolean;
  night: boolean;
  snow: boolean;
  foliage: Foliage;
  pill: string;
  pillText: string;
  name?: string;
}) {
  const artW = box.art * scale;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="image"
      accessibilityLabel={name}
      style={[styles.door, { left: box.x * scale, top: box.y * scale, width: box.w * scale }]}
    >
      <TownPlace id="catwalk" width={artW} reducedMotion={reducedMotion} night={night} snow={snow} foliage={foliage} />
      <View style={[styles.label, { marginTop: -6 * scale, backgroundColor: pill }]}>
        <Text style={[styles.labelText, { fontSize: labelSize, color: pillText }]}>{name}</Text>
      </View>
    </View>
  );
}

function Door({
  building,
  scale,
  labelSize,
  reducedMotion,
  night,
  snow,
  foliage,
  pill,
  pillText,
  onPress,
}: {
  building: Building;
  scale: number;
  labelSize: number;
  reducedMotion: boolean;
  night: boolean;
  snow: boolean;
  foliage: Foliage;
  pill: string;
  pillText: string;
  onPress: () => void;
}) {
  const artW = building.art * scale;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={building.name}
      onPress={onPress}
      style={[
        styles.door,
        {
          left: building.x * scale,
          top: building.y * scale,
          width: building.w * scale,
          minHeight: 44,
        },
      ]}
    >
      <TownPlace id={building.id} width={artW} reducedMotion={reducedMotion} night={night} snow={snow} foliage={foliage} />
      <View style={[styles.label, { marginTop: -6 * scale, backgroundColor: pill }]}>
        <Text style={[styles.labelText, { fontSize: labelSize, color: pillText }]}>{building.name}</Text>
      </View>
    </Pressable>
  );
}

function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} style={styles.backHit}>
      {({ pressed }) => (
        <View style={[styles.backFace, pressed && styles.backPressed]}>
          <ChevronLeft size={24} strokeWidth={3} color="#6B6F8A" />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerWide: {
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  backHit: {
    width: 48,
    height: 48,
  },
  backFace: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#282C50',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
  },
  backPressed: {
    transform: [{ translateY: 2 }],
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  titlesWide: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 18,
  },
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 34,
  },
  titleWide: {
    fontSize: 38,
  },
  subtitle: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 17,
  },
  subtitleWide: {
    fontSize: 18,
  },
  scroll: {
    flex: 1,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 96,
  },
  map: {
    overflow: 'hidden',
  },
  door: {
    position: 'absolute',
    alignItems: 'center',
  },
  label: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
    shadowColor: '#4B3B7A',
    shadowOpacity: 0.18,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  labelText: {
    fontFamily: fontFamily.fredokaSemibold,
  },
  pulse: {
    position: 'absolute',
    width: 56,
    height: 22,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#F59AC9',
  },
  pet: {
    position: 'absolute',
    width: petW,
    height: petH,
  },
  walkDock: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 36,
    alignItems: 'center',
  },
  walkPill: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#282C50',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  walkText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 15,
    color: '#2C2F4A',
    flex: 1,
    marginLeft: 8,
  },
  skip: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 16,
    color: '#7A5AF5',
    marginLeft: 12,
  },
});
