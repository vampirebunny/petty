import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  SlideInDown,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Check, ChevronLeft, Clock, Minus, Plus, ShoppingBag, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Network from 'expo-network';

import { playBloop } from '../audio/bloop';
import { playVoice } from '../audio/voice';
import { PawCoin } from '../components/currency/PawCoin';
import { catalogItem } from '../economy/catalog';
import { localDay, nextLocalMidnight } from '../economy/clock';
import { buyLimited } from '../economy/limited';
import { limitedSerial, newRequestId, purchaseCart } from '../economy/service';
import type { InventoryRow } from '../economy/service';
import {
  contentsValue,
  countdownLabel,
  discounted,
  featuredBundle,
  featuredLimited,
  fitsSpecies,
  limitedBuyLabel,
  isNewItem,
  priceCart,
  savePercent,
  shownDeal,
  shownPicks,
  tabItems,
  type ShopCatalog,
  type ShopCategory,
  type ShopListing,
  type SpeciesId,
} from '../economy/shop';
import { stockedSkus } from '../actor/furniture';
import { currentOwner } from '../db/currentOwner';
import { furnitureOf, subscribePlayerHome } from '../db/playerHome';
import { ensureShopDay, loadLimitedStock, loadShopCatalog } from '../economy/shopState';
import { refreshShopCatalog } from '../economy/shopSync';
import type { Equipped, OutfitSlot, PetState } from '../sim/types';
import { useLimitedContentWidth } from '../ui/PhoneColumn';
import { useOpenedDuoBoopEdge, useOpenedDuoTopInset } from '../ui/useDeviceOrientation';
import { isLandscapeSplit } from '../ui/wideLayout';
import { fontFamily } from '../ui/font';
import { ConservatoryPreview } from '../ui/shop/ConservatoryPreview';
import { GetBoopsSheet } from '../ui/shop/GetBoopsSheet';
import { Glossy, LedgeCard } from '../ui/shop/Glossy';
import { ItemArt } from '../ui/shop/ItemArt';
import { LilacFace } from '../ui/shop/LilacFace';
import { ShopStage } from '../ui/shop/ShopStage';
import { shop, shopRadius } from '../ui/shop/theme';

type CartRow = { id: string; kind: 'item' | 'bundle'; qty: number; addedAt: number };

type Props = {
  pet: PetState;
  balance: number;
  inventory: InventoryRow[];
  toys: string[];
  species: SpeciesId;
  reducedMotion: boolean;
  onClose: () => void;
  onOpenCloset: () => void;
};

const categories: { id: ShopCategory; title: string; note: string }[] = [
  { id: 'treats', title: 'Treats & Food', note: 'Goes to your Pantry' },
  { id: 'clothes', title: 'Clothes', note: 'Try on, then Closet' },
  { id: 'toys', title: 'Toys', note: 'Goes to your Toy Box' },
  { id: 'home', title: 'Furniture', note: 'Goes in your home' },
  { id: 'boosts', title: 'Boosts', note: 'Goes to your Pantry' },
];

function money(amount: number): string {
  return amount.toLocaleString('en-US');
}

function placeLine(place: string): string {
  if (place === 'Closet') {
    return 'Goes to your Closet';
  }
  if (place === 'Toy Box') {
    return 'Goes to your Toy Box';
  }
  if (place === 'Home') {
    return 'Goes in your home';
  }
  if (place === 'Storage') {
    return 'Goes to Storage';
  }
  return 'Goes to your Pantry';
}

function ownedIds(inventory: InventoryRow[], toys: string[]): Set<string> {
  const owned = new Set<string>(toys);
  for (const row of inventory) {
    if (row.qty <= 0) {
      continue;
    }
    const item = catalogItem(row.itemId);
    if (item?.kind === 'outfit' || item?.kind === 'toy' || item?.kind === 'furniture') {
      owned.add(row.itemId);
    }
  }
  return owned;
}

function findItem(catalog: ShopCatalog, id: string): ShopListing | null {
  return catalog.items.find((item) => item.id === id) ?? null;
}

function tryOn(catalog: ShopCatalog | null, cart: CartRow[]): Map<OutfitSlot, string> {
  const wearing = new Map<OutfitSlot, { id: string; at: number }>();
  if (!catalog) {
    return new Map();
  }
  for (const row of cart) {
    if (row.kind !== 'item') {
      continue;
    }
    const item = findItem(catalog, row.id);
    if (!item?.slot) {
      continue;
    }
    const prev = wearing.get(item.slot);
    if (!prev || row.addedAt >= prev.at) {
      wearing.set(item.slot, { id: item.id, at: row.addedAt });
    }
  }
  return new Map([...wearing.entries()].map(([slot, worn]) => [slot, worn.id]));
}

function wearingHas(wearing: Map<OutfitSlot, string>, id: string): boolean {
  for (const itemId of wearing.values()) {
    if (itemId === id) {
      return true;
    }
  }
  return false;
}

function lineIsStackable(catalog: ShopCatalog, line: { id: string; kind: 'item' | 'bundle' }): boolean {
  if (line.kind === 'bundle') {
    return true;
  }
  return findItem(catalog, line.id)?.stackable ?? false;
}

function StillCoin({ size }: { size: number }) {
  const spin = useSharedValue(0);
  return <PawCoin size={size} spinAngle={spin} shine={false} />;
}

export function PetShopScreen({
  pet,
  balance,
  inventory,
  toys,
  species,
  reducedMotion,
  onClose,
  onOpenCloset,
}: Props) {
  const { width: windowWidth, height: screenH } = useWindowDimensions();
  const limited = useLimitedContentWidth();
  const split = limited == null && isLandscapeSplit(windowWidth, screenH);
  const pane = split ? windowWidth / 2 : (limited ?? windowWidth);
  const duoTop = useOpenedDuoTopInset();
  const boopEdge = useOpenedDuoBoopEdge();
  const stageWidthPx = pane - 32;
  const cardWidth = Math.max(156, Math.min(188, Math.round((pane - 44) / 2.2)));
  const celebrateSpin = useSharedValue(0);
  const celebrateDrop = useSharedValue(0);
  const [now, setNow] = useState(() => Date.now());
  const [clock, setClock] = useState(() => Date.now());
  const [cart, setCart] = useState<CartRow[]>([]);
  const [sheet, setSheet] = useState(false);
  const [boopsOpen, setBoopsOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [housePreview, setHousePreview] = useState(false);
  const [celebration, setCelebration] = useState<{ charge: number; lines: { name: string; place: string }[]; closet: boolean } | null>(
    null,
  );
  const [online, setOnline] = useState(true);
  const [crownRequest, setCrownRequest] = useState<string | null>(null);
  const dealRef = useRef<string | null>(null);
  const dayRef = useRef<string | null>(null);
  const dealReady = useRef(false);
  const catalog = useMemo(() => loadShopCatalog(now), [now]);
  const day = useMemo(() => (catalog ? ensureShopDay(species, now) : null), [catalog, now, species]);
  const [homeTick, setHomeTick] = useState(0);
  useEffect(() => subscribePlayerHome(() => setHomeTick((value) => value + 1)), []);
  const owned = useMemo(() => {
    const ids = ownedIds(inventory, toys);
    if (homeTick < 0) return ids;
    const pieces = furnitureOf(currentOwner());
    for (const piece of pieces) {
      ids.add(piece.id);
    }
    for (const sku of stockedSkus(pieces)) {
      ids.add(sku);
    }
    return ids;
  }, [homeTick, inventory, toys]);
  // `now` moves when the catalog or the shop day refreshes, which is when cached stock should reload.
  const stock = useMemo(() => (now > 0 ? loadLimitedStock() : []), [now]);
  // Off until the Golden Crown art is ready. The limited row and buy path stay in place.
  const showLimitedCrown = false;
  const limitedOffer = showLimitedCrown ? featuredLimited(stock, clock) : null;
  const dealId = day ? shownDeal(day.dealId, day.picks, owned) : null;
  const picks = day ? shownPicks(day.picks, owned) : [];
  const quote = useMemo(() => {
    if (!catalog || !day) {
      return null;
    }
    return priceCart(
      catalog,
      cart.map(({ id, kind, qty }) => ({ id, kind, qty })),
      dealId,
      owned,
      species,
      Number.MAX_SAFE_INTEGER,
    );
  }, [cart, catalog, day, dealId, owned, species]);

  useEffect(() => {
    void refreshShopCatalog().then((ok) => {
      if (ok) {
        setNow(Date.now());
      }
    });
    void Network.getNetworkStateAsync().then((state) => {
      setOnline(state.isConnected !== false);
    });
  }, []);

  useEffect(() => {
    if (catalog) {
      return;
    }
    const timer = setInterval(() => {
      void refreshShopCatalog().then((ok) => {
        if (ok) {
          setNow(Date.now());
        }
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [catalog]);

  useEffect(() => {
    const wait = Math.max(0, nextLocalMidnight(localDay(now)) - Date.now()) + 40;
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [now]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const date = day?.date ?? null;
    if (!dealReady.current) {
      dealReady.current = true;
      dealRef.current = dealId;
      dayRef.current = date;
      return;
    }
    const previous = dealRef.current;
    const dayChanged = dayRef.current != null && date != null && date !== dayRef.current;
    if (dayChanged && previous && cart.some((row) => row.kind === 'item' && row.id === previous)) {
      setNote("Today's deal ended. Price updated.");
      setSheet(true);
    }
    dealRef.current = dealId;
    dayRef.current = date;
  }, [cart, day?.date, dealId]);

  const wearing = useMemo(() => tryOn(catalog, cart), [cart, catalog]);
  const equipped = useMemo(() => {
    const next: Equipped = { ...pet.equipped };
    if (!catalog) {
      return next;
    }
    for (const [slot, itemId] of wearing) {
      const item = findItem(catalog, itemId);
      if (item?.wearId) {
        next[slot] = item.wearId;
      }
    }
    return next;
  }, [catalog, pet.equipped, wearing]);

  useEffect(() => {
    if (!celebration) {
      celebrateSpin.value = 0;
      celebrateDrop.value = 0;
      return;
    }
    if (reducedMotion) {
      return;
    }
    celebrateSpin.value = withRepeat(withTiming(360, { duration: 1300, easing: Easing.inOut(Easing.ease) }), -1, false);
    celebrateDrop.value = withRepeat(
      withSequence(
        withTiming(-22, { duration: 650, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 650, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [celebrateDrop, celebrateSpin, celebration, reducedMotion]);

  const coinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: celebrateDrop.value }, { perspective: 400 }],
  }));

  const cartCount = cart.reduce((sum, row) => sum + row.qty, 0);
  const charge = quote?.ok ? quote.charge : 0;
  const short = Math.max(0, charge - balance);
  const canBuy = !!quote?.ok && cart.length > 0 && short === 0 && !busy;
  const today = localDay(clock);
  const bundle = catalog && !limitedOffer ? featuredBundle(catalog, today) : null;
  const rowBundles = (catalog?.bundles ?? []).filter((entry) => entry.id !== bundle?.id);
  const crown = limitedOffer && catalog ? findItem(catalog, limitedOffer.itemId) : null;
  const crownSerial = crown && owned.has(crown.id) ? limitedSerial(crown.id) : null;
  const crownLabel = limitedBuyLabel(limitedOffer, online);
  const groups = catalog
    ? categories
        .map((entry) => ({ ...entry, items: tabItems(catalog, entry.id, species) }))
        .filter((entry) => entry.items.length > 0 || (entry.id === 'treats' && rowBundles.length > 0))
    : [];
  const remain = day ? nextLocalMidnight(day.date) - clock : 0;

  const add = (id: string, kind: CartRow['kind']) => {
    setCart((rows) => {
      const existing = rows.find((row) => row.id === id && row.kind === kind);
      if (existing && kind === 'item') {
        const item = catalog ? findItem(catalog, id) : null;
        if (item && !item.stackable) {
          return rows;
        }
      }
      if (existing) {
        return rows.map((row) => (row === existing ? { ...row, qty: row.qty + 1, addedAt: Date.now() } : row));
      }
      return [...rows, { id, kind, qty: 1, addedAt: Date.now() }];
    });
  };
  const remove = (id: string, kind: CartRow['kind']) => {
    setCart((rows) => rows.filter((row) => !(row.id === id && row.kind === kind)));
  };
  const setQty = (id: string, kind: CartRow['kind'], qty: number) => {
    if (qty < 1) {
      remove(id, kind);
      return;
    }
    setCart((rows) => rows.map((row) => (row.id === id && row.kind === kind ? { ...row, qty } : row)));
  };

  const buy = () => {
    if (!canBuy) {
      return;
    }
    setBusy(true);
    const result = purchaseCart(
      cart.map(({ id, kind, qty }) => ({ id, kind, qty })),
      newRequestId(),
      species,
      pet.sceneId,
    );
    setBusy(false);
    if (!result.ok || result.charge == null || !result.lines) {
      return;
    }
    setCart([]);
    setSheet(false);
    setCelebration({
      charge: result.charge,
      closet: !!result.includesClothes,
      lines: result.lines.map((line) => ({ name: line.qty > 1 ? `${line.name} ×${line.qty}` : line.name, place: line.place })),
    });
    playVoice({ actorId: pet.id, sound: species === 'cat' ? 'meow' : 'bark', rate: 1 });
    playBloop(0);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const confirmCrown = () => {
    if (!crownRequest || !crown || crown.price == null || busy) {
      return;
    }
    setBusy(true);
    const price = crown.price;
    const name = crown.name;
    void buyLimited(crown.id, price, crownRequest).then((result) => {
      setBusy(false);
      setCrownRequest(null);
      setNow(Date.now());
      if (!result.ok) {
        setNote(
          result.reason === 'lost'
            ? 'Sorry, the last one sold just before your purchase went through. Your Boops have been returned.'
            : result.reason === 'insufficient_boops'
              ? 'Not enough Boops.'
              : 'Connect to buy.',
        );
        return;
      }
      if (result.status === 'confirmed') {
        setNote(null);
        setCelebration({ charge: price, closet: true, lines: [{ name, place: 'Closet' }] });
        playVoice({ actorId: pet.id, sound: species === 'cat' ? 'meow' : 'bark', rate: 1 });
        playBloop(0);
      }
    });
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, duoTop > 0 ? { paddingTop: 54 + duoTop } : null]}>
        <View style={styles.headerLead}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            accessibilityLabel="Boop Boop"
            accessibilityIgnoresInvertColors
          />
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onClose} style={styles.backHit}>
            {({ pressed }) => (
              <Glossy variant="white" pressed={pressed} style={styles.backFace}>
                <ChevronLeft size={22} strokeWidth={2.8} color={shop.inkStrong} />
              </Glossy>
            )}
          </Pressable>
        </View>
        <Text style={[styles.title, boopEdge > 16 ? { right: 124 + (boopEdge - 16) } : null]} pointerEvents="none" numberOfLines={1}>
          Pet Shop
        </Text>
        <Glossy variant="white" style={[styles.pill, boopEdge > 16 ? { marginRight: boopEdge - 16 } : null]}>
          <StillCoin size={28} />
          <Text style={styles.pillText}>{money(balance)}</Text>
        </Glossy>
      </View>
      {!catalog || !day ? (
        <View style={styles.closed}>
          <Text style={styles.closedTitle}>The shop is opening soon!</Text>
          <Text style={styles.closedBody}>Connect to the internet to visit.</Text>
        </View>
      ) : (
        <View style={split ? styles.split : styles.stack}>
          <View style={split ? styles.preview : undefined}>
            <ShopStage
              pet={pet}
              equipped={equipped}
              reducedMotion={reducedMotion}
              width={stageWidthPx}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Buy Boops"
              onPress={() => setBoopsOpen(true)}
              style={styles.getBoops}
            >
              {({ pressed }) => (
                <LilacFace pressed={pressed} radius={22} height={56}>
                  <StillCoin size={26} />
                  <Text style={styles.getBoopsText}>Buy Boops</Text>
                </LilacFace>
              )}
            </Pressable>
          </View>
          <ScrollView
            style={split ? styles.choices : styles.choicesFill}
            contentContainerStyle={styles.scroll}
            directionalLockEnabled
            showsVerticalScrollIndicator={false}
          >
            {note && !sheet ? <Text style={styles.note}>{note}</Text> : null}
            <Animated.View key={day.date} entering={reducedMotion ? undefined : FadeIn.duration(280)} style={styles.picks}>
              <View style={styles.picksHead}>
                <Text style={styles.section}>{"Today's picks"}</Text>
                <Glossy variant="white" ledge={2} style={styles.countChip}>
                  <Clock size={14} strokeWidth={2.6} color={shop.inkAccent} />
                  <Text style={styles.countText}>{countdownLabel(remain)}</Text>
                </Glossy>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickRow}>
                {picks.map((pick) => {
                  const item = findItem(catalog, pick.itemId);
                  if (!item || !fitsSpecies(item.species, species)) {
                    return null;
                  }
                  return (
                    <ShopCard
                      key={pick.itemId}
                      item={item}
                      catalog={catalog}
                      deal={item.id === dealId}
                      fresh={isNewItem(item, today)}
                      owned={owned.has(item.id)}
                      row={cart.find((entry) => entry.kind === 'item' && entry.id === item.id) ?? null}
                      wearing={wearingHas(wearing, item.id)}
                      width={142}
                      butter
                      species={species}
                      onPreview={item.id === 'dogHouse' ? () => setHousePreview(true) : undefined}
                      onAdd={() => add(item.id, 'item')}
                      onRemove={() => remove(item.id, 'item')}
                      onQty={(qty) => setQty(item.id, 'item', qty)}
                    />
                  );
                })}
              </ScrollView>
            </Animated.View>
            {limitedOffer && crown ? (
              <LimitedCard
                name={crown.name}
                price={crown.price ?? 0}
                cap={limitedOffer.cap}
                unitsLeft={limitedOffer.unitsLeft}
                label={crownLabel}
                serial={crownSerial}
                busy={busy}
                onBuy={() => setCrownRequest(newRequestId())}
              />
            ) : null}
            {bundle ? (
              <BundleCard
                name={bundle.name}
                description={bundle.description}
                price={bundle.price}
                was={contentsValue(bundle, catalog.items)}
                percent={savePercent(bundle.price, contentsValue(bundle, catalog.items))}
                qty={cart.find((row) => row.kind === 'bundle' && row.id === bundle.id)?.qty ?? 0}
                catalog={catalog}
                onAdd={() => add(bundle.id, 'bundle')}
                onQty={(qty) => setQty(bundle.id, 'bundle', qty)}
              />
            ) : null}
            {groups.map((group) => (
              <View key={group.id} style={styles.category}>
                <View style={styles.categoryHead}>
                  <Text style={styles.section} accessibilityRole="header">
                    {group.title}
                  </Text>
                  <Text style={styles.categoryNote}>{group.note}</Text>
                </View>
                <ScrollView
                  horizontal
                  nestedScrollEnabled
                  directionalLockEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoryRow}
                >
                  {group.items.map((item) => (
                    <ShopCard
                      key={item.id}
                      item={item}
                      catalog={catalog}
                      deal={item.id === dealId}
                      fresh={isNewItem(item, today)}
                      owned={!item.stackable && owned.has(item.id)}
                      row={cart.find((entry) => entry.kind === 'item' && entry.id === item.id) ?? null}
                      wearing={wearingHas(wearing, item.id)}
                      width={cardWidth}
                      species={species}
                      onPreview={item.id === 'dogHouse' ? () => setHousePreview(true) : undefined}
                      onAdd={() => add(item.id, 'item')}
                      onRemove={() => remove(item.id, 'item')}
                      onQty={(qty) => setQty(item.id, 'item', qty)}
                    />
                  ))}
                  {group.id === 'treats'
                    ? rowBundles.map((entry) => (
                        <BundleCard
                          key={entry.id}
                          name={entry.name}
                          description={entry.description}
                          price={entry.price}
                          was={contentsValue(entry, catalog.items)}
                          percent={savePercent(entry.price, contentsValue(entry, catalog.items))}
                          qty={cart.find((row) => row.kind === 'bundle' && row.id === entry.id)?.qty ?? 0}
                          catalog={catalog}
                          onAdd={() => add(entry.id, 'bundle')}
                          onQty={(qty) => setQty(entry.id, 'bundle', qty)}
                        />
                      ))
                    : null}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      {cart.length > 0 && !sheet && !celebration && !boopsOpen ? (
        <CartBar
          count={cartCount}
          charge={charge}
          reducedMotion={reducedMotion}
          onOpen={() => setSheet(true)}
          side={split}
        />
      ) : null}
      {crownRequest && crown && crown.price != null ? (
        <View style={styles.crownSheet}>
          <Text style={styles.crownAsk}>Buy the {crown.name} for {money(crown.price)} Boops?</Text>
          <View style={styles.crownActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="Buy the Golden Crown" onPress={confirmCrown} disabled={busy}>
              <Glossy variant="gold" style={styles.crownBuy}>
                <Text style={styles.crownBuyText}>{busy ? 'Buying…' : 'Buy'}</Text>
              </Glossy>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Not now" onPress={() => setCrownRequest(null)}>
              <Text style={styles.crownLater}>Not now</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      {sheet && quote?.ok && catalog ? (
        <CartSheet
          catalog={catalog}
          quote={quote}
          balance={balance}
          short={short}
          note={note}
          busy={busy}
          canBuy={canBuy}
          petName={pet.name}
          reducedMotion={reducedMotion}
          maxHeight={screenH * 0.7}
          onClose={() => setSheet(false)}
          onRemove={remove}
          onQty={setQty}
          onBuy={buy}
        />
      ) : null}
      {celebration ? (
        <View style={styles.celebrate}>
          <Animated.View style={coinStyle} entering={reducedMotion ? FadeIn.duration(180) : FadeIn.duration(350)}>
            <PawCoin size={110} spinAngle={celebrateSpin} shine shineMs={1300} />
          </Animated.View>
          <Text style={styles.yay}>Yay! {pet.name} loves it!</Text>
          <Text style={styles.debit}>−{money(celebration.charge)} Boops</Text>
          <View style={styles.grantList}>
            {celebration.lines.map((line) => (
              <View key={`${line.name}${line.place}`} style={styles.grantPill}>
                <View style={styles.grantLedge} />
                <Text style={styles.grant}>
                  {line.name} → {line.place}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.celebrateButtons}>
            <Pressable accessibilityRole="button" accessibilityLabel="Keep shopping" onPress={() => setCelebration(null)} style={styles.celebrateHit}>
              {({ pressed }) => (
                <Glossy variant="mint" pressed={pressed} style={styles.celebrateFace}>
                  <Text style={[styles.celebrateText, { color: shop.onMint }]}>Keep shopping</Text>
                </Glossy>
              )}
            </Pressable>
            {celebration.closet ? (
              <Pressable accessibilityRole="button" accessibilityLabel="Open Closet" onPress={onOpenCloset} style={styles.celebrateHit}>
                {({ pressed }) => (
                  <Glossy variant="white" pressed={pressed} style={styles.celebrateFace}>
                    <Text style={[styles.celebrateText, { color: shop.inkStrong }]}>Open Closet</Text>
                  </Glossy>
                )}
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
      {boopsOpen ? (
        <GetBoopsSheet balance={balance} reducedMotion={reducedMotion} onClose={() => setBoopsOpen(false)} />
      ) : null}
      <Modal visible={housePreview} transparent animationType="fade" onRequestClose={() => setHousePreview(false)}>
        <Pressable style={styles.previewScrim} onPress={() => setHousePreview(false)}>
          <Pressable onPress={() => undefined}>
            <ConservatoryPreview
              pet={pet}
              reducedMotion={reducedMotion}
              onAdd={() => add('dogHouse', 'item')}
              onClose={() => setHousePreview(false)}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ShopCard({
  item,
  catalog,
  deal,
  fresh,
  owned,
  row,
  wearing,
  width,
  butter,
  species,
  onPreview,
  onAdd,
  onRemove,
  onQty,
}: {
  item: ShopListing;
  catalog: ShopCatalog;
  deal: boolean;
  fresh: boolean;
  owned: boolean;
  row: CartRow | null;
  wearing: boolean;
  width: number;
  butter?: boolean;
  species?: 'dog' | 'cat';
  onPreview?: () => void;
  onAdd: () => void;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  const soon = item.shop === 'coming_soon';
  const price = item.price == null ? null : deal ? discounted(item.price, catalog.dealPct) : item.price;
  const clothes = item.category === 'clothes';
  const artSize = Math.round(width - 24);
  return (
    <View style={[styles.cardSlot, { width }, !butter && styles.cardStretch]}>
      <LedgeCard
        face={butter ? shop.butter : shop.surface}
        ledge={butter ? shop.butterLedge : shop.cardLedge}
        radius={shopRadius.card}
        fill={!butter}
        style={[styles.card, butter && styles.cardCenter]}
      >
        {butter ? (
          <ItemArt itemId={item.id} catalog={catalog} size={64} soon={soon} species={species} />
        ) : (
          <Pressable
            accessibilityRole={onPreview ? 'button' : undefined}
            accessibilityLabel={onPreview ? 'Preview Pup Cabana' : undefined}
            disabled={!onPreview}
            onPress={onPreview}
            style={[styles.well, { width: artSize, height: artSize }]}
          >
            <ItemArt itemId={item.id} catalog={catalog} size={artSize} soon={soon} species={species} />
          </Pressable>
        )}
        <Text style={[styles.name, butter && styles.centered]}>{item.name}</Text>
        {item.tier === 'exclusive' ? (
          <View style={styles.exclusivePill}>
            <Text style={styles.exclusiveText}>Exclusive</Text>
          </View>
        ) : null}
        {item.restMultiplier != null && item.restMultiplier > 1 ? (
          <View style={[styles.restPill, item.restMultiplier > 2 ? styles.restDeluxe : null]}>
            <Text style={[styles.restText, item.restMultiplier > 2 ? styles.restTextDeluxe : null]}>
              {item.restMultiplier === 2 ? '2× faster rest' : '2.5× faster rest'}
            </Text>
          </View>
        ) : null}
        {item.description && !butter ? <Text style={styles.desc}>{item.description}</Text> : null}
        {deal && item.price != null ? (
          <Text style={[styles.dealLine, butter && styles.centered]}>
            Deal of the day · <Text style={styles.struck}>{money(item.price)}</Text>
          </Text>
        ) : null}
        {!soon && !owned && price != null ? (
          <View style={[styles.priceRow, butter && styles.priceCenter]}>
            <StillCoin size={16} />
            <Text style={[styles.price, butter && styles.pricePick]}>{money(price)}</Text>
          </View>
        ) : null}
        <View style={styles.spacer} />
        <CardAction
          soon={soon}
          owned={owned}
          row={row}
          wearing={wearing}
          stackable={item.stackable}
          clothes={clothes}
          name={item.name}
          onAdd={onAdd}
          onRemove={onRemove}
          onQty={onQty}
        />
      </LedgeCard>
      {fresh ? (
        <View style={styles.newBadge}>
          <Text style={styles.newText}>NEW</Text>
        </View>
      ) : null}
      {deal && price != null ? (
        <View style={styles.dealBadge}>
          <Glossy variant="gold" ledge={2} style={styles.dealFace}>
            <Text style={styles.dealText}>DEAL −{catalog.dealPct}%</Text>
          </Glossy>
        </View>
      ) : null}
    </View>
  );
}

function CardAction({
  soon,
  owned,
  row,
  wearing,
  stackable,
  clothes,
  name,
  onAdd,
  onRemove,
  onQty,
}: {
  soon: boolean;
  owned: boolean;
  row: CartRow | null;
  wearing: boolean;
  stackable: boolean;
  clothes: boolean;
  name: string;
  onAdd: () => void;
  onRemove: () => void;
  onQty: (qty: number) => void;
}) {
  if (soon) {
    return (
      <View style={[styles.flatPill, { backgroundColor: shop.soonBg }]}>
        <Text style={[styles.flatText, { color: shop.soonText }]}>Coming soon</Text>
      </View>
    );
  }
  if (owned) {
    return (
      <View style={[styles.flatPill, { backgroundColor: shop.lavender }]}>
        <Check size={16} strokeWidth={3} color={shop.onLavender} />
        <Text style={[styles.flatText, { color: shop.onLavender }]}>Owned</Text>
      </View>
    );
  }
  if (row && stackable) {
    return <Stepper qty={row.qty} onChange={onQty} />;
  }
  if (row) {
    const label = wearing ? 'Wearing' : 'In cart';
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onRemove} style={styles.full}>
        {({ pressed }) => (
          <Glossy variant="pink" pressed={pressed} style={styles.action}>
            <Check size={16} strokeWidth={3} color={shop.onPink} />
            <Text style={[styles.button, { color: shop.onPink }]}>{label}</Text>
          </Glossy>
        )}
      </Pressable>
    );
  }
  const label = clothes ? 'Try on' : 'Add';
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label} ${name}`} onPress={onAdd} style={styles.full}>
      {({ pressed }) => (
        <Glossy variant="mint" pressed={pressed} style={styles.action}>
          <Text style={[styles.button, { color: shop.onMint }]}>{label}</Text>
        </Glossy>
      )}
    </Pressable>
  );
}

function LimitedCard({
  name,
  price,
  cap,
  unitsLeft,
  label,
  serial,
  busy,
  onBuy,
}: {
  name: string;
  price: number;
  cap: number;
  unitsLeft: number;
  label: 'buy' | 'offline' | 'held' | 'sold_out';
  serial: number | null;
  busy: boolean;
  onBuy: () => void;
}) {
  const button =
    serial != null ? `#${serial} of ${cap}` : label === 'offline' ? 'Connect to buy' : label === 'held' ? 'None left right now' : label === 'sold_out' ? 'Sold out' : 'Buy';
  const disabled = busy || label !== 'buy' || serial != null;
  return (
    <View style={styles.bundleWrap}>
      <LedgeCard face={shop.gold} ledge={shop.goldDeep} radius={shopRadius.bundle} style={styles.bundle}>
        <View style={styles.bundleText}>
          <View style={styles.limitedPill}>
            <Text style={styles.limitedText}>Limited</Text>
          </View>
          <Text style={styles.bundleName}>{name}</Text>
          <Text style={styles.bundleBody}>{serial != null ? `#${serial} of ${cap}` : `${unitsLeft} of ${cap} left`}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={button} disabled={disabled} onPress={onBuy}>
            <Glossy variant={disabled ? 'white' : 'gold'} style={styles.crownBuy}>
              <Text style={styles.crownBuyText}>{button}</Text>
            </Glossy>
          </Pressable>
        </View>
        <Text style={styles.bundlePrice}>{money(price)}</Text>
      </LedgeCard>
    </View>
  );
}

function BundleCard({
  name,
  description,
  price,
  was,
  percent,
  qty,
  catalog,
  onAdd,
  onQty,
}: {
  name: string;
  description?: string;
  price: number;
  was: number;
  percent: number;
  qty: number;
  catalog: ShopCatalog;
  onAdd: () => void;
  onQty: (qty: number) => void;
}) {
  return (
    <View style={styles.bundleWrap}>
      <LedgeCard face={shop.lavender} ledge={shop.lavenderLedge} radius={shopRadius.bundle} style={styles.bundle}>
        <View style={styles.bundleArt}>
          <ItemArt itemId="biscuit" catalog={catalog} size={68} />
        </View>
        <View style={styles.bundleText}>
          <Text style={styles.bundleLabel}>BUNDLE</Text>
          <Text style={styles.bundleName}>{name}</Text>
          {description ? <Text style={styles.bundleBody}>{description}</Text> : null}
          <View style={styles.bundleBottom}>
            <StillCoin size={18} />
            <Text style={styles.bundlePrice}>{money(price)}</Text>
            <Text style={styles.bundleWas}>{money(was)}</Text>
            <View style={styles.spacer} />
            {qty > 0 ? (
              <Stepper qty={qty} onChange={onQty} compact />
            ) : (
              <Pressable accessibilityRole="button" accessibilityLabel={`Add ${name}`} onPress={onAdd}>
                {({ pressed }) => (
                  <Glossy variant="mint" pressed={pressed} style={styles.bundleAdd}>
                    <Text style={[styles.button, { color: shop.onMint }]}>Add</Text>
                  </Glossy>
                )}
              </Pressable>
            )}
          </View>
        </View>
      </LedgeCard>
      <View style={styles.save}>
        <Text style={styles.saveText}>Save {percent}%</Text>
      </View>
    </View>
  );
}

function Stepper({ qty, onChange, compact }: { qty: number; onChange: (qty: number) => void; compact?: boolean }) {
  return (
    <View style={[styles.stepper, compact && styles.stepperCompact]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Less" onPress={() => onChange(qty - 1)}>
        {({ pressed }) => (
          <Glossy variant="white" pressed={pressed} style={styles.step}>
            <Minus size={18} strokeWidth={3} color={shop.inkStrong} />
          </Glossy>
        )}
      </Pressable>
      <Text style={styles.stepQty}>{qty}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="More" onPress={() => onChange(qty + 1)}>
        {({ pressed }) => (
          <Glossy variant="mint" pressed={pressed} style={styles.step}>
            <Plus size={18} strokeWidth={3} color={shop.onMint} />
          </Glossy>
        )}
      </Pressable>
    </View>
  );
}

function CartBar({
  count,
  charge,
  reducedMotion,
  onOpen,
  side,
}: {
  count: number;
  charge: number;
  reducedMotion: boolean;
  onOpen: () => void;
  side?: boolean;
}) {
  const scale = useSharedValue(reducedMotion ? 1 : 0.6);
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const bump = useSharedValue(1);
  const seen = useRef(count);
  useEffect(() => {
    opacity.value = withTiming(1, { duration: reducedMotion ? 180 : 200 });
    scale.value = reducedMotion
      ? 1
      : withSequence(
          withTiming(1.08, { duration: 220, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: 130, easing: Easing.out(Easing.cubic) }),
        );
  }, [opacity, reducedMotion, scale]);
  useEffect(() => {
    if (seen.current !== count && !reducedMotion) {
      bump.value = withSequence(withTiming(1.06, { duration: 90 }), withTiming(1, { duration: 90 }));
    }
    seen.current = count;
  }, [bump, count, reducedMotion]);
  const barStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value * bump.value }],
  }));
  return (
    <Animated.View style={[styles.cartBar, side && styles.cartBarSide, barStyle]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Open cart" onPress={onOpen}>
        {({ pressed }) => (
          <Glossy variant="pink" pressed={pressed} highlight ledge={4} style={styles.cartFace}>
            <ShoppingBag size={26} strokeWidth={2.4} color={shop.onPink} />
            <Text style={styles.cartCount}>
              {count} {count === 1 ? 'item' : 'items'}
            </Text>
            <View style={styles.spacer} />
            <Glossy variant="white" ledge={2} ledgeColor={shop.pinkLedge} style={styles.totalPill}>
              <StillCoin size={18} />
              <Text style={styles.totalText}>{money(charge)}</Text>
            </Glossy>
          </Glossy>
        )}
      </Pressable>
    </Animated.View>
  );
}

function CartSheet({
  catalog,
  quote,
  balance,
  short,
  note,
  busy,
  canBuy,
  petName,
  reducedMotion,
  maxHeight,
  onClose,
  onRemove,
  onQty,
  onBuy,
}: {
  catalog: ShopCatalog;
  quote: Extract<ReturnType<typeof priceCart>, { ok: true }>;
  balance: number;
  short: number;
  note: string | null;
  busy: boolean;
  canBuy: boolean;
  petName: string;
  reducedMotion: boolean;
  maxHeight: number;
  onClose: () => void;
  onRemove: (id: string, kind: CartRow['kind']) => void;
  onQty: (id: string, kind: CartRow['kind'], qty: number) => void;
  onBuy: () => void;
}) {
  const drag = useSharedValue(0);
  const pan = Gesture.Pan()
    .onUpdate((event) => {
      drag.value = Math.max(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        runOnJS(onClose)();
        return;
      }
      drag.value = withTiming(0, { duration: 180 });
    });
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drag.value }] }));
  return (
    <View style={styles.sheetLayer}>
      <Pressable accessibilityLabel="Close cart" style={styles.dim} onPress={onClose} />
      <Animated.View
        entering={reducedMotion ? FadeIn.duration(180) : SlideInDown.duration(250)}
        style={[styles.sheet, { maxHeight }, sheetStyle]}
      >
        <GestureDetector gesture={pan}>
          <View>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Your cart</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose}>
                {({ pressed }) => (
                  <View style={[styles.close, pressed && styles.closePressed]}>
                    <X size={18} strokeWidth={3} color={shop.inkStrong} />
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </GestureDetector>
        <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          {quote.lines.map((line) => (
            <View key={`${line.kind}${line.id}`} style={styles.line}>
              <View style={styles.lineArt}>
                <ItemArt itemId={line.kind === 'bundle' ? 'biscuit' : line.id} catalog={catalog} size={42} />
              </View>
              <View style={styles.lineText}>
                <Text style={styles.lineName}>{line.name}</Text>
                <Text style={styles.lineMeta}>{placeLine(line.place)}</Text>
              </View>
              {lineIsStackable(catalog, line) ? (
                <Stepper qty={line.qty} onChange={(qty) => onQty(line.id, line.kind, qty)} compact />
              ) : (
                <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${line.name}`} onPress={() => onRemove(line.id, line.kind)}>
                  <View style={styles.removePill}>
                    <Text style={styles.remove}>Remove</Text>
                  </View>
                </Pressable>
              )}
              <Text style={styles.lineTotal}>{money(line.lineTotal)}</Text>
            </View>
          ))}
          {note ? (
            <View style={styles.notePill}>
              <Text style={styles.note}>{note}</Text>
            </View>
          ) : null}
          <View style={styles.summary}>
            <Text style={styles.summaryTotal}>Total {money(quote.charge)} Boops</Text>
            <Text style={styles.summaryLine}>You have {money(balance)}</Text>
            <Text style={styles.summaryLine}>After checkout {money(Math.max(0, balance - quote.charge))}</Text>
          </View>
          {short > 0 ? (
            <View style={styles.warn}>
              <Text style={styles.warnText}>
                You need {money(short)} more Boops. Play with {petName} to earn more!
              </Text>
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Buy for ${quote.charge} Boops`}
            disabled={!canBuy}
            onPress={onBuy}
            style={!canBuy && styles.dimBuy}
          >
            {({ pressed }) => (
              <Glossy variant="gold" pressed={pressed && canBuy} highlight ledge={4} style={styles.buy}>
                <Text style={styles.buyText}>{busy ? '...' : `Buy for ${money(quote.charge)} Boops`}</Text>
              </Glossy>
            )}
          </Pressable>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: shop.bg },
  previewScrim: {
    flex: 1,
    backgroundColor: 'rgba(40, 24, 32, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerLead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 48, height: 48, borderRadius: 12 },
  backHit: { width: 44, height: 44 },
  backFace: { width: 44, height: 44 },
  title: {
    position: 'absolute',
    left: 124,
    right: 124,
    top: 62,
    textAlign: 'center',
    fontFamily: fontFamily.fredokaBold,
    fontSize: 26,
    color: shop.inkStrong,
  },
  pill: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 6, paddingRight: 14 },
  pillText: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  closed: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  closedTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 26, color: shop.inkStrong, textAlign: 'center' },
  closedBody: { fontFamily: fontFamily.bold, fontSize: 16, color: shop.inkMuted, textAlign: 'center' },
  stack: { flex: 1 },
  split: { flex: 1, flexDirection: 'row' },
  preview: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    borderRightWidth: 4,
    borderRightColor: shop.pinkLine,
  },
  getBoops: {
    marginTop: 14,
    marginHorizontal: 16,
    shadowColor: '#7E62D6',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
  },
  getBoopsText: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: '#2E1A5E' },
  choices: { flex: 1, minWidth: 0 },
  choicesFill: { flex: 1 },
  scroll: { paddingTop: 16, paddingBottom: 120, gap: 18 },
  picks: { gap: 0 },
  picksHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  section: { fontFamily: fontFamily.fredokaSemibold, fontSize: 20, color: shop.inkStrong },
  countChip: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10 },
  countText: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.inkAccent },
  pickRow: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  category: { gap: 10 },
  categoryHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryNote: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.inkMuted },
  categoryRow: { paddingHorizontal: 16, paddingTop: 12, gap: 12, alignItems: 'stretch' },
  cardSlot: { overflow: 'visible' },
  cardStretch: { alignSelf: 'stretch' },
  card: { padding: 12, gap: 6 },
  cardCenter: { alignItems: 'center' },
  well: {
    borderRadius: shopRadius.well,
    backgroundColor: shop.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  name: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink },
  centered: { textAlign: 'center' },
  desc: { fontFamily: fontFamily.bold, fontSize: 12, lineHeight: 15, color: shop.inkMuted },
  dealLine: { fontFamily: fontFamily.extraBold, fontSize: 12, color: shop.butterInk },
  struck: { textDecorationLine: 'line-through' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  priceCenter: { alignSelf: 'center' },
  price: { fontFamily: fontFamily.black, fontSize: 15, color: shop.onGold },
  pricePick: { fontSize: 14 },
  spacer: { flex: 1 },
  action: { minHeight: 44, width: '100%', flexDirection: 'row', gap: 6, paddingHorizontal: 12 },
  button: { fontFamily: fontFamily.black, fontSize: 15 },
  full: { width: '100%' },
  flatPill: {
    width: '100%',
    minHeight: 44,
    borderRadius: shopRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  flatText: { fontFamily: fontFamily.extraBold, fontSize: 14 },
  newBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
    backgroundColor: shop.pink,
    borderRadius: shopRadius.pill,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newText: { fontFamily: fontFamily.black, fontSize: 10, letterSpacing: 0.6, color: shop.onPink },
  dealBadge: { position: 'absolute', top: -8, right: -4, zIndex: 3, transform: [{ rotate: '6deg' }] },
  dealFace: { paddingHorizontal: 10, paddingVertical: 5 },
  dealText: { fontFamily: fontFamily.black, fontSize: 11, letterSpacing: 0.4, color: shop.onGold },
  exclusivePill: { alignSelf: 'center', backgroundColor: '#EFE6FF', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  restPill: { alignSelf: 'center', backgroundColor: '#D7F6EA', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  restDeluxe: { backgroundColor: '#FFE1A8' },
  restText: { fontFamily: fontFamily.black, fontSize: 11, color: '#1F7A56' },
  restTextDeluxe: { color: '#8A4B08' },
  exclusiveText: { fontFamily: fontFamily.black, fontSize: 11, color: '#4B3A8A' },
  limitedPill: { alignSelf: 'flex-start', backgroundColor: '#FFF1B8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  limitedText: { fontFamily: fontFamily.black, fontSize: 11, color: '#6B4600' },
  crownSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: shop.surface,
    borderRadius: 20,
    padding: 16,
    gap: 12,
  },
  crownAsk: { fontFamily: fontFamily.fredokaSemibold, fontSize: 18, color: shop.inkStrong },
  crownActions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  crownBuy: { minHeight: 44, paddingHorizontal: 18, justifyContent: 'center' },
  crownBuyText: { fontFamily: fontFamily.black, fontSize: 15, color: shop.onGold },
  crownLater: { fontFamily: fontFamily.extraBold, fontSize: 15, color: shop.inkMuted },
  bundleWrap: { marginHorizontal: 16 },
  bundle: { flexDirection: 'row', gap: 12, padding: 14 },
  bundleArt: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: shop.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bundleText: { flex: 1, gap: 2 },
  bundleLabel: { fontFamily: fontFamily.black, fontSize: 11, letterSpacing: 0.8, color: shop.bundleLabel },
  bundleName: { fontFamily: fontFamily.fredokaSemibold, fontSize: 19, color: shop.bundleTitle },
  bundleBody: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.bundleBody },
  bundleBottom: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  bundlePrice: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  bundleWas: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.struck, textDecorationLine: 'line-through' },
  bundleAdd: { minHeight: 44, paddingHorizontal: 18 },
  save: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: shop.pink,
    borderRadius: shopRadius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  saveText: { fontFamily: fontFamily.black, fontSize: 11, color: shop.onPink },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperCompact: { width: 'auto', gap: 4, justifyContent: 'center' },
  step: { width: 44, height: 44 },
  stepQty: { fontFamily: fontFamily.black, fontSize: 17, color: shop.inkStrong, minWidth: 18, textAlign: 'center' },
  cartBar: { position: 'absolute', left: 16, right: 16, bottom: 34 },
  cartBarSide: { left: '50%', marginLeft: 16 },
  cartFace: {
    minHeight: 62,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingLeft: 18,
    paddingRight: 10,
    gap: 8,
  },
  cartCount: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onPink },
  totalPill: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12 },
  totalText: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  sheetLayer: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end', zIndex: 5 },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: shop.scrim },
  sheet: {
    backgroundColor: shop.surface,
    borderTopLeftRadius: shopRadius.sheet,
    borderTopRightRadius: shopRadius.sheet,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 14,
  },
  sheetScroll: { gap: 14, paddingBottom: 12 },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: shop.pinkLine, marginBottom: 8 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontFamily: fontFamily.fredokaBold, fontSize: 22, color: shop.inkStrong },
  close: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: shop.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { opacity: 0.7 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: shop.bg,
    borderRadius: shopRadius.line,
    padding: 8,
  },
  lineArt: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: shop.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineText: { flex: 1, gap: 2 },
  lineName: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink },
  lineMeta: { fontFamily: fontFamily.bold, fontSize: 12, color: shop.inkMuted },
  lineTotal: { width: 52, textAlign: 'right', fontFamily: fontFamily.black, fontSize: 14, color: shop.onGold },
  removePill: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  remove: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.inkAccent },
  notePill: { alignSelf: 'flex-start', backgroundColor: shop.butter, borderRadius: shopRadius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  note: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.butterInk },
  summary: { backgroundColor: shop.butter, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  summaryTotal: { fontFamily: fontFamily.black, fontSize: 16, color: shop.onGold },
  summaryLine: { fontFamily: fontFamily.bold, fontSize: 13, color: shop.butterInk },
  warn: { backgroundColor: shop.warnBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  warnText: { fontFamily: fontFamily.extraBold, fontSize: 13, color: shop.warnText, textAlign: 'center' },
  buy: { minHeight: 60, width: '100%' },
  buyText: { fontFamily: fontFamily.fredokaBold, fontSize: 20, color: shop.onGold },
  dimBuy: { opacity: 0.5 },
  celebrate: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,244,250,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 14,
    zIndex: 6,
  },
  yay: { fontFamily: fontFamily.fredokaBold, fontSize: 30, color: shop.inkStrong, textAlign: 'center' },
  debit: { fontFamily: fontFamily.black, fontSize: 16, color: shop.inkAccent },
  grantList: { gap: 6, maxWidth: 280, alignItems: 'center' },
  grantPill: { borderRadius: 14, backgroundColor: shop.surface, paddingBottom: 2 },
  grantLedge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 14,
    borderRadius: 14,
    backgroundColor: shop.pinkLine,
  },
  grant: { fontFamily: fontFamily.extraBold, fontSize: 14, color: shop.ink, paddingHorizontal: 14, paddingVertical: 10 },
  celebrateButtons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  celebrateHit: { flexGrow: 1 },
  celebrateFace: { minHeight: 52, paddingHorizontal: 28 },
  celebrateText: { fontFamily: fontFamily.black, fontSize: 16 },
});
