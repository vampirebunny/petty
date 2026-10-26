import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft, PawPrint } from 'lucide-react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';

import type { RoadSpot } from '../../sim/road';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { useContentWidth } from '../PhoneColumn';
import { ArcadeIcon, SchoolIcon, ShopIcon, TreeIcon } from '../places/locationIcons';
import { HomeCottage } from './HomeCottage';
import { HomeRoomSheet } from './HomeRoomSheet';
import { buildingById, buildings, edges, grass, mapHeight, mapWidth, nodes, type Point } from './map';
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

function curve(edge: (typeof edges)[number]): string {
  const { a, c1, c2, b } = edge.cubic;
  return `M${a.x} ${a.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${b.x} ${b.y}`;
}

export function TownScreen({ pet, species, roadSpot, reducedMotion, onStand, onEnter, onShop, onArcade }: Props) {
  const contentWidth = useContentWidth();
  const mapW = Math.min(maxMapWidth, contentWidth);
  const scale = mapW / mapWidth;
  const mapH = mapHeight * scale;
  const rooms = homeRooms(species);
  const scrollRef = useRef<ScrollView>(null);
  const viewport = useRef(0);
  const revealed = useRef(false);
  const outingRef = useRef<Outing | null>(null);
  const token = useRef(0);
  const [outing, setOuting] = useState<Outing | null>(null);
  const [along, setAlong] = useState(0);
  const [spot, setSpot] = useState<Point>(nodes[roadSpot]);
  const [face, setFace] = useState<1 | -1>(1);
  const [sheet, setSheet] = useState(false);
  const zoom = useSharedValue(1);
  const pulse = useSharedValue(0);
  const spotRef = useRef(roadSpot);
  const reducedRef = useRef(reducedMotion);
  const scaleRef = useRef(scale);
  const progressRef = useRef(0);
  const frameRef = useRef(0);
  const actions = useRef({ onStand, onEnter, onShop, onArcade });
  const finishRef = useRef<(dest: RoadSpot) => void>(() => {});

  useEffect(() => {
    actions.current = { onStand, onEnter, onShop, onArcade };
  }, [onArcade, onEnter, onShop, onStand]);

  useEffect(() => {
    spotRef.current = roadSpot;
    reducedRef.current = reducedMotion;
    scaleRef.current = scale;
    if (!outingRef.current) {
      setSpot(nodes[roadSpot]);
    }
  }, [reducedMotion, roadSpot, scale]);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 900 }), -1, false);
  }, [pulse]);

  const scrollToPet = (y: number) => {
    const view = viewport.current;
    if (view <= 0) {
      return;
    }
    scrollRef.current?.scrollTo({ y: Math.max(0, y - view * 0.45), animated: false });
  };

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

  const setZoom = (value: number) => {
    zoom.value = value;
  };
  const startZoom = (done: (finished?: boolean) => void) => {
    zoom.value = withTiming(1.16, { duration: 300 }, done);
  };

  const finish = (dest: RoadSpot) => {
    cancelAnimationFrame(frameRef.current);
    outingRef.current = null;
    setOuting(null);
    setSpot(nodes[dest]);
    setAlong(0);
    const actionsNow = actions.current;
    if (dest === 'home') {
      zoom.value = 1;
      actionsNow.onStand('home');
      setSheet(true);
      return;
    }
    if (dest === 'petShop') {
      actionsNow.onShop();
      return;
    }
    if (dest === 'arcade') {
      actionsNow.onArcade();
      return;
    }
    if (dest === 'park') {
      actionsNow.onEnter('park');
      return;
    }
    actionsNow.onEnter('school');
  };

  useEffect(() => {
    finishRef.current = finish;
  });

  const arrive = (dest: RoadSpot) => {
    if (reducedRef.current) {
      finish(dest);
      return;
    }
    const landed = (spotId: RoadSpot) => {
      requestAnimationFrame(() => finishRef.current(spotId));
    };
    startZoom((done) => {
      if (done) {
        runOnJS(landed)(dest);
      }
    });
  };

  const play = (next: Outing) => {
    const id = token.current;
    outingRef.current = next;
    setOuting(next);
    setSheet(false);
    progressRef.current = 0;
    setAlong(0);
    setSpot(next.points[0] ?? nodes[next.origin]);
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
      legs = at ? legsFromProgress(at.edge, at.t, dest) : legsBetween(spotRef.current, dest);
    } else {
      legs = legsBetween(spotRef.current, dest);
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
    cancelAnimation(zoom);
    setZoom(1);
    outingRef.current = null;
    setOuting(null);
    setAlong(0);
    setSpot(nodes[current.origin]);
    actions.current.onStand(current.origin);
  };

  const mapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - pulse.value),
    transform: [{ scale: 0.7 + pulse.value * 0.6 }],
  }));

  const destBuilding = outing ? buildingById(outing.dest) : null;
  const dots = outing
    ? outing.points.filter((_, index) => index >= Math.floor(along * Math.max(0, outing.points.length - 1)) && index % 3 === 0)
    : [];
  const depth = 0.9 + 0.1 * Math.max(0, Math.min(1, spot.y / mapHeight));

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        {outing ? <BackButton onPress={stopWalk} /> : <View style={styles.backSpacer} />}
        <View style={styles.titles}>
          <Text style={styles.title}>Boop Boop Town</Text>
          <Text style={styles.subtitle}>Pick a spot for {pet.name}</Text>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onLayout={(event) => {
          viewport.current = event.nativeEvent.layout.height;
          if (!revealed.current) {
            revealed.current = true;
            scrollToPet(nodes[spotRef.current].y * scaleRef.current);
          }
        }}
      >
        <Animated.View style={[{ width: mapW, height: mapH }, mapStyle]}>
          <View style={[styles.map, { width: mapW, height: mapH }]}>
            <Svg width={mapW} height={mapH} viewBox={`0 0 ${mapWidth} ${mapHeight}`}>
              <Path d={`M0 0 H${mapWidth} V${mapHeight} H0 Z`} fill={grass.ground} />
              <Ellipse cx={70} cy={180} rx={90} ry={46} fill={grass.light} />
              <Ellipse cx={300} cy={300} rx={110} ry={54} fill={grass.dark} opacity={0.45} />
              <Ellipse cx={120} cy={500} rx={80} ry={36} fill={grass.light} />
              <Ellipse cx={18} cy={280} rx={36} ry={18} fill={grass.waterDeep} />
              <Ellipse cx={16} cy={276} rx={30} ry={13} fill={grass.water} />
              <Ellipse cx={150} cy={250} rx={18} ry={12} fill="#7DCE63" />
              <Ellipse cx={168} cy={256} rx={14} ry={10} fill="#9ADF7A" />
              <Ellipse cx={250} cy={470} rx={16} ry={11} fill="#7DCE63" />
              <Circle cx={40} cy={160} r={3} fill="#F7B6D6" />
              <Circle cx={54} cy={168} r={2.4} fill="#FFE29A" />
              <Circle cx={320} cy={190} r={3} fill="#C9B6FF" />
              <Circle cx={80} cy={430} r={2.6} fill="#FFFFFF" />
              <Circle cx={210} cy={520} r={3} fill="#F7B6D6" />
              {edges.map((edge) => (
                <Path
                  key={`${edge.id}-out`}
                  d={curve(edge)}
                  stroke={grass.pathOuter}
                  strokeWidth={26}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
              {edges.map((edge) => (
                <Path
                  key={`${edge.id}-in`}
                  d={curve(edge)}
                  stroke={grass.pathInner}
                  strokeWidth={18}
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
              <Circle cx={nodes.plazaA.x} cy={nodes.plazaA.y} r={24} fill={grass.pathOuter} />
              <Circle cx={nodes.plazaA.x} cy={nodes.plazaA.y} r={16} fill={grass.plaza} />
              <Circle cx={nodes.plazaB.x} cy={nodes.plazaB.y} r={26} fill={grass.pathOuter} />
              <Circle cx={nodes.plazaB.x} cy={nodes.plazaB.y} r={18} fill={grass.plaza} />
              <Circle cx={nodes.plazaB.x} cy={nodes.plazaB.y} r={8} fill={grass.water} />
              <Circle cx={nodes.plazaB.x} cy={nodes.plazaB.y - 1} r={3} fill="#FFFFFF" opacity={0.8} />
              {dots.map((dot, index) => (
                <Circle key={`${dot.x}-${dot.y}-${index}`} cx={dot.x} cy={dot.y} r={3.2} fill="#F59AC9" />
              ))}
            </Svg>
            {buildings.map((building) => (
              <Door key={building.id} buildingId={building.id} scale={scale} onPress={() => tap(building.id)} />
            ))}
            {destBuilding ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.pulse,
                  pulseStyle,
                  {
                    left: (destBuilding.x + destBuilding.w / 2) * scale - 28,
                    top: (destBuilding.y + destBuilding.h) * scale - 10,
                  },
                ]}
              />
            ) : null}
            <View
              pointerEvents="none"
              style={[
                styles.pet,
                {
                  left: spot.x * scale - petW / 2,
                  top: spot.y * scale - petH + 8,
                  transform: [{ scale: depth }],
                },
              ]}
            >
              <TownPet pet={pet} walking={outing != null} face={face} reducedMotion={reducedMotion} width={petW} height={petH} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>
      {outing ? (
        <View style={styles.walkPill}>
          <PawPrint size={18} color="#F59AC9" strokeWidth={2.4} />
          <Text style={styles.walkText}>Walking to the {buildingById(outing.dest).name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={() => tap(outing.dest)} hitSlop={8}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
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

function Door({ buildingId, scale, onPress }: { buildingId: RoadSpot; scale: number; onPress: () => void }) {
  const building = buildingById(buildingId);
  const width = building.w * scale;
  const artH = building.h * scale;
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
          width,
          height: Math.max(44, building.h * scale + 28),
        },
      ]}
    >
      {building.id === 'home' ? (
        <HomeCottage width={width} height={artH} />
      ) : building.id === 'petShop' ? (
        <ShopIcon size={width} />
      ) : building.id === 'park' ? (
        <TreeIcon size={width} />
      ) : building.id === 'trainingSchool' ? (
        <SchoolIcon size={width} />
      ) : (
        <ArcadeIcon size={width} />
      )}
      <View style={styles.label}>
        <Text style={styles.labelText}>{building.name}</Text>
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
    backgroundColor: '#F6F7FB',
    paddingTop: 64,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backSpacer: {
    width: 8,
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
  title: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 32,
    color: '#2C2F4A',
  },
  subtitle: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 15,
    color: '#6B6F8A',
  },
  scroll: {
    flex: 1,
    backgroundColor: grass.ground,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 96,
  },
  map: {
    overflow: 'hidden',
    backgroundColor: grass.ground,
  },
  door: {
    position: 'absolute',
    alignItems: 'center',
  },
  label: {
    marginTop: -18,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minHeight: 24,
    justifyContent: 'center',
  },
  labelText: {
    fontFamily: fontFamily.fredokaBold,
    fontSize: 13,
    color: '#2C2F4A',
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
  walkPill: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
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
