import { createElement, useMemo, useState } from 'react';
import { Check, Lock, Play, X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { PawCoin } from '../../components/currency/PawCoin';
import { ageAllowsTrick, tricksForSpecies, type TrickListing } from '../../sim/tricks';
import type { PetState } from '../../sim/types';
import { fontFamily } from '../font';
import { iconStroke } from '../theme';
import { familyPaint, GlossyFace, gold, greySurface, ink, secondary, white } from './gloss';
import {
  colorFamilyOf,
  isQuickLearn,
  shopOrder,
  stageAgeLabel,
  traitLabel,
  trickIsNew,
  trickOfTheDay,
  untilMidnightLabel,
} from './order';
import { TrickDemo } from './TrickDemo';
import { trickIcon } from './trickIcon';

type Filter = 'all' | 'quick' | 'props';

type Props = {
  pet: PetState;
  species: 'dog' | 'cat';
  balance: number;
  ownerId: string;
  ownedPropTypes: string[];
  now: number;
  reducedMotion: boolean;
  onBuy: (trick: TrickListing) => void;
  onShop: () => void;
};

export function TrickShop({
  pet,
  species,
  balance,
  ownerId,
  ownedPropTypes,
  now,
  reducedMotion,
  onBuy,
  onShop,
}: Props) {
  const tricks = tricksForSpecies(species);
  const ownedTypes = useMemo(() => new Set(ownedPropTypes), [ownedPropTypes]);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<TrickListing | null>(null);
  const locked = tricks.filter((trick) => !pet.training[trick.id] && !ageAllowsTrick(pet.ageDays, trick.minAgeStage));
  const buyable = tricks.filter((trick) => pet.training[trick.id] || ageAllowsTrick(pet.ageDays, trick.minAgeStage));
  const featured = trickOfTheDay(
    buyable.filter((trick) => !pet.training[trick.id]),
    ownerId,
    now,
  );
  const visible = buyable.filter((trick) => {
    if (filter === 'quick') {
      return isQuickLearn(trick);
    }
    if (filter === 'props') {
      return trick.propType != null;
    }
    return true;
  });
  const ordered = shopOrder(
    visible.map((trick) => {
      const track = pet.training[trick.id];
      return {
        id: trick.id,
        price: trick.priceBoops,
        mastered: Boolean(track?.mastered),
        owned: Boolean(track),
        fresh: trickIsNew(trick.id, now),
        affordable: balance >= trick.priceBoops,
      };
    }),
  );
  const byId = new Map(visible.map((trick) => [trick.id, trick]));

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Trick Shop</Text>
      <Text style={styles.sub}>New tricks {pet.name} can learn</Text>
      {featured ? (
        <Hero
          trick={featured}
          petName={pet.name}
          species={species}
          now={now}
          reducedMotion={reducedMotion}
          ownsProp={featured.propType != null && ownedTypes.has(featured.propType)}
          onOpen={() => setOpen(featured)}
        />
      ) : null}
      <View style={styles.filters}>
        <Chip label="All" selected={filter === 'all'} onPress={() => setFilter('all')} />
        <Chip label="Quick learn" selected={filter === 'quick'} onPress={() => setFilter('quick')} />
        <Chip label="With props" selected={filter === 'props'} onPress={() => setFilter('props')} />
      </View>
      {ordered.length === 0 ? <Text style={styles.sub}>Nothing in this filter.</Text> : null}
      <View style={styles.grid}>
        {ordered.map((id) => {
          const trick = byId.get(id);
          if (!trick) {
            return null;
          }
          return (
            <ShopCard
              key={id}
              trick={trick}
              track={pet.training[id]}
              ownsProp={trick.propType != null && ownedTypes.has(trick.propType)}
              fresh={trickIsNew(id, now)}
              onOpen={() => setOpen(trick)}
            />
          );
        })}
      </View>
      {locked.length > 0 ? (
        <View style={styles.lockedBox}>
          <View style={styles.lockedHead}>
            <Text style={styles.lockedTitle}>When {pet.name} is older</Text>
            <Text style={styles.lockedCount}>
              {locked.length} trick{locked.length === 1 ? '' : 's'}
            </Text>
          </View>
          <View style={styles.grid}>
            {locked.map((trick) => (
              <View key={trick.id} style={styles.lockedRow}>
                <View style={styles.lockBubble}>
                  <Lock size={16} strokeWidth={iconStroke + 0.4} color={secondary} />
                </View>
                <View style={styles.lockedCopy}>
                  <Text style={styles.lockedName} numberOfLines={1}>
                    {trick.name}
                  </Text>
                  <Text style={styles.lockedAge} numberOfLines={1}>
                    At {stageAgeLabel(trick.minAgeStage, species)} age
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <PreviewSheet
        trick={open}
        petName={pet.name}
        species={species}
        balance={balance}
        ownsProp={open?.propType != null && ownedTypes.has(open.propType)}
        reducedMotion={reducedMotion}
        onClose={() => setOpen(null)}
        onBuy={() => {
          if (!open) {
            return;
          }
          const trick = open;
          setOpen(null);
          onBuy(trick);
        }}
        onShop={() => {
          setOpen(null);
          onShop();
        }}
      />
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress}>
      {selected ? (
        <View style={styles.chipOn}>
          <Text style={styles.chipOnText}>{label}</Text>
        </View>
      ) : (
        <GlossyFace colors={[white, '#F7F8FC']} lip={cardLip} shadow={cardLip} radius={999} style={styles.chip}>
          <Text style={styles.chipText}>{label}</Text>
        </GlossyFace>
      )}
    </Pressable>
  );
}

const cardLip = '#E1E4EF';

function Hero({
  trick,
  petName,
  species,
  now,
  reducedMotion,
  ownsProp,
  onOpen,
}: {
  trick: TrickListing;
  petName: string;
  species: 'dog' | 'cat';
  now: number;
  reducedMotion: boolean;
  ownsProp: boolean;
  onOpen: () => void;
}) {
  const [width, setWidth] = useState(280);
  return (
    <Pressable accessibilityRole="button" onPress={onOpen}>
      <GlossyFace colors={['#FFD9EA', '#E6D6FF']} lip="#D7B7E8" shadow="#C9A6DE" soft="rgba(230, 214, 255, 0.45)" radius={28} style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.kicker}>
            <Text style={styles.kickerText}>TRICK OF THE DAY</Text>
          </View>
          <Text style={styles.countdown}>New in {untilMidnightLabel(now)}</Text>
        </View>
        <View
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.width);
            setWidth((current) => (current === next ? current : next));
          }}
        >
          <DemoStage
            species={species}
            trickId={trick.id}
            width={width}
            height={150}
            reducedMotion={reducedMotion}
            background={familyPaint[colorFamilyOf(trick.id)].card[0]}
          />
        </View>
        <View style={styles.heroBottom}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{trick.name}</Text>
            <View style={styles.chips}>
              {trick.attributesRaised.map((trait) => (
                <View key={trait} style={styles.attrChip}>
                  <Text style={styles.attrText}>+ {traitLabel[trait]}</Text>
                </View>
              ))}
              {trick.propName ? (
                <View style={styles.attrChip}>
                  <Text style={styles.attrText}>{ownsProp ? `You have a ${trick.propName}` : `+ ${trick.propName}`}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <PriceButton price={trick.priceBoops} onPress={onOpen} tall />
        </View>
      </GlossyFace>
    </Pressable>
  );
}

function ShopCard({
  trick,
  track,
  ownsProp,
  fresh,
  onOpen,
}: {
  trick: TrickListing;
  track: PetState['training'][string] | undefined;
  ownsProp: boolean;
  fresh: boolean;
  onOpen: () => void;
}) {
  const family = familyPaint[colorFamilyOf(trick.id)];
  const glyph = trickIcon(trick.id);
  const learned = Boolean(track?.mastered);
  const owned = Boolean(track) && !learned;
  const tappable = !track;
  const badge = fresh
    ? 'NEW'
    : trick.propName && !track
      ? ownsProp
        ? `You have a ${trick.propName}`
        : `+ ${trick.propName} included`
      : null;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!tappable}
      onPress={onOpen}
      style={styles.cardHit}
    >
      <View style={styles.card}>
        <View style={[styles.art, { backgroundColor: family.card[0] }]}>
          <View style={[styles.artShade, { backgroundColor: family.card[1] }]} />
          {createElement(glyph, { size: 46, strokeWidth: iconStroke + 0.2, color: family.ring[1] })}
          {badge ? (
            <View style={[styles.badge, fresh ? styles.badgeNew : null]}>
              <Text style={[styles.badgeText, fresh ? styles.badgeNewText : null]} numberOfLines={1}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardName} numberOfLines={2}>
          {trick.name}
        </Text>
        {learned ? (
          <View style={styles.statusGrey}>
            <Check size={14} strokeWidth={2.4} color={secondary} />
            <Text style={styles.statusGreyText}>Learned</Text>
          </View>
        ) : owned ? (
          <View style={styles.statusLilac}>
            <Check size={14} strokeWidth={2.4} color="#3B2577" />
            <Text style={styles.statusLilacText}>In training</Text>
          </View>
        ) : (
          <PriceButton price={trick.priceBoops} onPress={onOpen} />
        )}
      </View>
    </Pressable>
  );
}

function PriceButton({ price, onPress, tall = false }: { price: number; onPress: () => void; tall?: boolean }) {
  const spin = useSharedValue(0);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Buy for ${price} Boops`} onPress={onPress}>
      {({ pressed }) => (
        <GlossyFace
          colors={[gold.top, gold.bottom]}
          lip={gold.inset}
          shadow={gold.base}
          radius={999}
          pressed={pressed}
          style={[styles.price, tall ? styles.priceTall : null]}
        >
          <PawCoin size={tall ? 22 : 16} spinAngle={spin} shine={false} />
          <Text style={[styles.priceText, tall ? styles.priceTextTall : null]}>{price}</Text>
        </GlossyFace>
      )}
    </Pressable>
  );
}

function DemoStage({
  species,
  trickId,
  width,
  height,
  reducedMotion,
  background,
  caption,
}: {
  species: 'dog' | 'cat';
  trickId: string;
  width: number;
  height: number;
  reducedMotion: boolean;
  background: string;
  caption?: string;
}) {
  const [playing, setPlaying] = useState(!reducedMotion);
  return (
    <View style={[styles.demo, { height, backgroundColor: background }]}>
      {playing ? (
        <TrickDemo species={species} trickId={trickId} width={width} height={height} />
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Play demo" onPress={() => setPlaying(true)} style={styles.play}>
          <Play size={22} strokeWidth={iconStroke + 0.4} color={ink} fill={white} />
        </Pressable>
      )}
      {caption ? (
        <View style={styles.caption}>
          <Text style={styles.captionText}>{caption}</Text>
        </View>
      ) : null}
    </View>
  );
}

function PreviewSheet({
  trick,
  petName,
  species,
  balance,
  ownsProp,
  reducedMotion,
  onClose,
  onBuy,
  onShop,
}: {
  trick: TrickListing | null;
  petName: string;
  species: 'dog' | 'cat';
  balance: number;
  ownsProp: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onBuy: () => void;
  onShop: () => void;
}) {
  const { height } = useWindowDimensions();
  const drag = useSharedValue(0);
  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 90) {
        drag.value = 0;
        runOnJS(onClose)();
        return;
      }
      drag.value = withTiming(0, { duration: 180 });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  const spin = useSharedValue(0);
  const short = trick ? Math.max(0, trick.priceBoops - balance) : 0;
  const affordable = trick != null && balance >= trick.priceBoops;
  const family = trick ? familyPaint[colorFamilyOf(trick.id)] : familyPaint.purple;
  return (
    <Modal visible={trick != null} transparent animationType={reducedMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <GestureDetector gesture={pan}>
        <Animated.View style={sheetStyle}>
          <Pressable style={[styles.sheet, { height: Math.round(height * 0.86) }]} onPress={() => undefined}>
            {trick ? (
              <>
                <View style={styles.sheetTop}>
                  <View style={styles.balance}>
                    <PawCoin size={18} spinAngle={spin} shine={false} />
                    <Text style={styles.balanceText}>{balance.toLocaleString()}</Text>
                  </View>
                  <View style={styles.grabber} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.close}>
                    <X size={18} strokeWidth={iconStroke + 0.4} color={ink} />
                  </Pressable>
                </View>
                <DemoStage
                  species={species}
                  trickId={trick.id}
                  width={320}
                  height={220}
                  reducedMotion={reducedMotion}
                  background={family.card[0]}
                  caption={species === 'cat' ? `Demo kitty · not ${petName}` : `Demo pup · not ${petName}`}
                />
                <Text style={styles.previewName}>{trick.name}</Text>
                <Text style={styles.previewBody}>{trick.description}</Text>
                <View style={styles.raiseCard}>
                  <Text style={styles.raiseLabel}>TRAINING RAISES</Text>
                  <View style={styles.chips}>
                    {trick.attributesRaised.map((trait) => (
                      <View key={trait} style={styles.raiseChip}>
                        <Text style={styles.raiseChipText}>+ {traitLabel[trait]}</Text>
                      </View>
                    ))}
                  </View>
                </View>
                {trick.propName ? (
                  <View style={styles.propCard}>
                    <Text style={styles.propTitle}>{ownsProp ? `Uses your ${trick.propName}` : `Comes with a ${trick.propName}!`}</Text>
                    <Text style={styles.propBody}>{ownsProp ? 'You already have one in Storage.' : 'Yours to keep for home and the park.'}</Text>
                  </View>
                ) : null}
                <View style={styles.spacer} />
                {affordable ? (
                  <Pressable accessibilityRole="button" onPress={onBuy}>
                    {({ pressed }) => (
                      <GlossyFace colors={[gold.top, gold.bottom]} lip={gold.inset} shadow={gold.base} radius={999} pressed={pressed} style={styles.buy}>
                        <Text style={styles.buyText}>Buy & start training</Text>
                        <View style={styles.buyPill}>
                          <PawCoin size={16} spinAngle={spin} shine={false} />
                          <Text style={styles.buyPrice}>{trick.priceBoops}</Text>
                        </View>
                      </GlossyFace>
                    )}
                  </Pressable>
                ) : (
                  <View style={styles.cant}>
                    <View style={styles.buyOff}>
                      <Text style={styles.buyOffText}>Need {short.toLocaleString()} more Boops</Text>
                    </View>
                    <Pressable accessibilityRole="button" onPress={onShop}>
                      <Text style={styles.shopLink}>Visit the Pet Shop</Text>
                    </Pressable>
                  </View>
                )}
              </>
            ) : null}
          </Pressable>
        </Animated.View>
        </GestureDetector>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  title: { fontFamily: fontFamily.fredokaSemibold, fontSize: 22, color: ink },
  sub: { fontFamily: fontFamily.bold, fontSize: 14, color: secondary, marginTop: -6 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 36, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: ink },
  chipOn: { minHeight: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: ink, alignItems: 'center', justifyContent: 'center' },
  chipOnText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: white },
  hero: { padding: 14, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  kicker: { backgroundColor: white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  kickerText: { fontFamily: fontFamily.extraBold, fontSize: 12, letterSpacing: 0.7, color: ink },
  countdown: { fontFamily: fontFamily.extraBold, fontSize: 13, color: '#7A3E62' },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroCopy: { flex: 1, gap: 6 },
  heroName: { fontFamily: fontFamily.fredokaBold, fontSize: 24, color: ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  attrChip: { backgroundColor: 'rgba(255,255,255,0.75)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  attrText: { fontFamily: fontFamily.extraBold, fontSize: 12, color: ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  cardHit: { width: '48%' },
  card: {
    backgroundColor: white,
    borderRadius: 24,
    padding: 12,
    gap: 8,
    borderBottomWidth: 4,
    borderBottomColor: cardLip,
  },
  art: {
    height: 100,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  artShade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '46%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    maxWidth: '90%',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeNew: { backgroundColor: ink },
  badgeText: { fontFamily: fontFamily.extraBold, fontSize: 11, color: ink },
  badgeNewText: { color: white },
  cardName: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: ink, minHeight: 44 },
  price: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  priceTall: { minHeight: 52, paddingHorizontal: 14 },
  priceText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: gold.ink },
  priceTextTall: { fontSize: 18 },
  statusGrey: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: greySurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statusGreyText: { fontFamily: fontFamily.extraBold, fontSize: 14, color: secondary },
  statusLilac: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: '#E6D6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statusLilacText: { fontFamily: fontFamily.extraBold, fontSize: 14, color: '#3B2577' },
  lockedBox: { backgroundColor: greySurface, borderRadius: 24, padding: 14, gap: 12 },
  lockedHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lockedTitle: { flex: 1, fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: ink },
  lockedCount: { fontFamily: fontFamily.extraBold, fontSize: 13, color: secondary },
  lockedRow: {
    width: '48%',
    backgroundColor: white,
    borderRadius: 16,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: greySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedCopy: { flex: 1 },
  lockedName: { fontFamily: fontFamily.fredokaSemibold, fontSize: 14, color: ink },
  lockedAge: { fontFamily: fontFamily.bold, fontSize: 12, color: secondary },
  demo: { borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  caption: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  captionText: { fontFamily: fontFamily.extraBold, fontSize: 11, color: ink },
  scrim: { flex: 1, backgroundColor: 'rgba(43, 47, 74, 0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 16,
    paddingBottom: 28,
    gap: 12,
  },
  sheetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balance: {
    minWidth: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF4D6',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  balanceText: { fontFamily: fontFamily.extraBold, fontSize: 14, color: gold.ink },
  grabber: { width: 48, height: 5, borderRadius: 3, backgroundColor: '#D5D8E4' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: greySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewName: { fontFamily: fontFamily.fredokaBold, fontSize: 28, color: ink },
  previewBody: { fontFamily: fontFamily.bold, fontSize: 15, color: secondary },
  raiseCard: { backgroundColor: '#F7F8FC', borderRadius: 18, padding: 12, gap: 8 },
  raiseLabel: { fontFamily: fontFamily.extraBold, fontSize: 12, letterSpacing: 0.6, color: secondary },
  raiseChip: { backgroundColor: white, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  raiseChipText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: ink },
  propCard: { backgroundColor: '#FFF4EA', borderRadius: 18, padding: 12, gap: 4 },
  propTitle: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: '#6E340A' },
  propBody: { fontFamily: fontFamily.bold, fontSize: 13, color: '#8A5A32' },
  spacer: { flexGrow: 1 },
  buy: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  buyText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: gold.ink },
  buyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  buyPrice: { fontFamily: fontFamily.extraBold, fontSize: 14, color: gold.ink },
  cant: { gap: 8, alignItems: 'center' },
  buyOff: {
    alignSelf: 'stretch',
    minHeight: 60,
    borderRadius: 999,
    backgroundColor: greySurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyOffText: { fontFamily: fontFamily.fredokaSemibold, fontSize: 16, color: secondary },
  shopLink: { fontFamily: fontFamily.extraBold, fontSize: 14, color: '#3E86DB' },
});
