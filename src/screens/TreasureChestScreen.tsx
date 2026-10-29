import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';

import { progressCount, visibleCatalogRows } from '../parkFinds/collection';
import { parkFindColorArt, parkFindSilhouetteArt } from '../parkFinds/artMap';
import { warmParkFindArtCache } from '../parkFinds/imageCache';
import type { ParkFindCatalogRow, PetParkFindsState } from '../parkFinds/types';
import { CandyShell, candyInk, tints } from '../ui/candy';

/** Item art aspect (120×150). Fills most of the cell; light pool sits under it. */
const ITEM_ASPECT = 120 / 150;
const COLS = 3;
const GAP = 10;
const PAD = 14;
/** Cap so three cells fit with padding on a typical phone (~390pt → ~114). */
const MAX_COL = 112;

type Props = {
  petId: string;
  petName: string;
  species: 'dog' | 'cat';
  adoptedAt: number;
  parkFinds: PetParkFindsState;
  reducedMotion: boolean;
  onClose: () => void;
  onMarkSeen: () => void;
};

type Cell = {
  row: ParkFindCatalogRow;
  found: boolean;
  count: number;
  isNew: boolean;
};

function columnSize(listWidth: number): number {
  if (listWidth <= 0) return MAX_COL;
  return Math.min(
    MAX_COL,
    Math.floor((listWidth - PAD * 2 - GAP * (COLS - 1)) / COLS),
  );
}

function CubeCell({
  cell,
  size,
  reducedMotion,
}: {
  cell: Cell;
  size: number;
  reducedMotion: boolean;
}) {
  const phase = (cell.row.sort_order % 97) * 0.07;
  const duration = 2.8 + (cell.row.sort_order % 11) * 0.09;
  const clock = useSharedValue(0);
  useFrameCallback((frame) => {
    if (reducedMotion) return;
    clock.value = (frame.timeSinceFirstFrame / 1000) % 1000;
  });
  const bob = useAnimatedStyle(() => {
    if (reducedMotion) {
      return { transform: [{ translateY: 0 }, { rotate: '0deg' }] };
    }
    const t = clock.value;
    const wave = Math.sin((Math.PI * 2 * t) / duration + phase);
    const lift = wave * -5;
    return {
      transform: [{ translateY: lift }, { rotate: `${wave * 1.5}deg` }],
    };
  });
  const light = useAnimatedStyle(() => {
    if (reducedMotion) return { transform: [{ scaleX: 1 }, { scaleY: 1 }] };
    const t = clock.value;
    const wave = Math.sin((Math.PI * 2 * t) / duration + phase);
    const s = 1 - (wave + 1) * 0.05;
    return { transform: [{ scaleX: s }, { scaleY: s }] };
  });

  const art = cell.found
    ? parkFindColorArt(cell.row.art_key, '2x')
    : parkFindSilhouetteArt(cell.row.art_key, '2x');
  // Nearly fill the cell; leave a little side pad and room for the light under the feet.
  const itemW = size * 0.92;
  const itemH = itemW / ITEM_ASPECT;
  const stageH = itemH + 14;
  const lightW = itemW * 0.55;
  const lightH = Math.max(6, size * 0.07);
  const rarityColor =
    cell.row.rarity === 'legendary'
      ? '#F5D76E'
      : cell.row.rarity === 'rare'
        ? '#9FD3FF'
        : cell.row.rarity === 'uncommon'
          ? '#9FE6C6'
          : '#CFC3EA';

  return (
    <View style={[styles.cell, { width: size }]}>
      <View style={[styles.stage, { width: size, height: stageH }]}>
        <Animated.View
          style={[
            styles.lightPool,
            {
              left: (size - lightW) / 2,
              bottom: 2,
              width: lightW,
              height: lightH,
            },
            light,
          ]}
        />
        <Animated.View
          style={[
            styles.itemWrap,
            {
              left: (size - itemW) / 2,
              top: 0,
              width: itemW,
              height: itemH,
            },
            bob,
          ]}
        >
          {art ? (
            <Image
              source={art}
              style={{ width: itemW, height: itemH }}
              resizeMode="contain"
            />
          ) : null}
        </Animated.View>
      </View>
      <View style={styles.caption}>
        <Text style={[styles.name, !cell.found && styles.nameMuted]} numberOfLines={2}>
          {cell.row.name}
        </Text>
        {cell.found ? (
          <Text style={[styles.meta, { color: rarityColor }]}>
            {cell.count === 1 ? 'Found once' : `Found ${cell.count} times`}
          </Text>
        ) : null}
        {cell.isNew ? (
          <View style={styles.newTag}>
            <Text style={styles.newText}>New!</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function TreasureChestScreen({
  petId,
  petName,
  species,
  adoptedAt,
  parkFinds,
  reducedMotion,
  onClose,
  onMarkSeen,
}: Props) {
  const flavor = tints.orchid;
  const ink = candyInk(flavor);
  const [now] = useState(() => Date.now());
  const [listWidth, setListWidth] = useState(() => Dimensions.get('window').width);
  const markSeenRef = useRef(onMarkSeen);
  useLayoutEffect(() => {
    markSeenRef.current = onMarkSeen;
  }, [onMarkSeen]);

  const progress = progressCount(parkFinds, species, adoptedAt, now);
  const foundMap = useMemo(() => {
    const map = new Map(parkFinds.items.map((row) => [row.itemId, row]));
    return map;
  }, [parkFinds.items]);
  const cells: Cell[] = useMemo(() => {
    const foundIds = new Set(foundMap.keys());
    return visibleCatalogRows(species, adoptedAt, now, foundIds).map((row) => {
      const rec = foundMap.get(row.id);
      return {
        row,
        found: !!rec,
        count: rec?.count ?? 0,
        isNew: !!rec && !rec.seen,
      };
    });
  }, [adoptedAt, foundMap, now, species]);

  useEffect(() => {
    warmParkFindArtCache();
  }, []);

  // Mark seen only when leaving the page — never depend on an unstable callback.
  useEffect(() => {
    return () => {
      markSeenRef.current();
    };
  }, [petId]);

  const col = columnSize(listWidth);

  return (
    <View style={styles.screen} key={petId}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backHit}
        >
          <CandyShell tint={flavor} radius={22} uid="chest-back" style={styles.back}>
            <ChevronLeft size={22} color={ink} />
          </CandyShell>
        </Pressable>
        <View style={styles.titles}>
          <Text style={styles.title}>Treasure Chest</Text>
          <Text style={styles.subtitle}>{`${petName}'s park finds`}</Text>
        </View>
      </View>
      <Text style={styles.progress}>
        {progress.found} of {progress.total} found
      </Text>
      {progress.found === 0 ? (
        <Text style={styles.empty}>Take {petName} to the park to find treasures.</Text>
      ) : null}
      <FlatList
        data={cells}
        keyExtractor={(item) => item.row.id}
        numColumns={COLS}
        style={styles.list}
        onLayout={(event) => {
          const next = Math.round(event.nativeEvent.layout.width);
          if (next > 0 && next !== listWidth) {
            setListWidth(next);
          }
        }}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <CubeCell cell={item} size={col} reducedMotion={reducedMotion} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#1E1630' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 54,
    paddingHorizontal: 16,
    gap: 12,
  },
  backHit: {},
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1 },
  title: { color: '#FFF6FF', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#C9B8E8', fontSize: 14, fontWeight: '600' },
  progress: {
    color: '#E8D9FF',
    fontWeight: '700',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  empty: {
    color: '#C9B8E8',
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 14,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: 40 },
  row: {
    gap: GAP,
    paddingHorizontal: PAD,
    justifyContent: 'center',
    marginBottom: GAP,
  },
  cell: { alignItems: 'center' },
  stage: { overflow: 'visible' },
  lightPool: {
    position: 'absolute',
    backgroundColor: 'rgba(255,248,230,0.55)',
    borderRadius: 99,
  },
  itemWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    paddingTop: 6,
    paddingHorizontal: 2,
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  name: {
    color: '#FFF6FF',
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'center',
  },
  nameMuted: { color: '#C9B8E8' },
  meta: {
    color: '#C9B8E8',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  newTag: {
    marginTop: 4,
    backgroundColor: '#FF7AB6',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newText: { color: '#fff', fontWeight: '800', fontSize: 11 },
});
