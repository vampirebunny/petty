import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Bone, Droplet, Heart, Moon, Package, Shirt, Sparkles, Utensils } from 'lucide-react-native';

import { candyInk } from '../candy';
import { fontFamily } from '../font';
import { ActionCard, ActionGrid } from './ActionCard';
import { Gloss } from './Gloss';
import { GoSomewhere } from './GoSomewhere';
import { needWord, StatStrip } from './StatStrip';
import { TabSwitcher, type HomeTab } from './TabSwitcher';
import { TrainingRow } from './TrainingRow';
import { ui } from './tokens';
import { isLandscapeSplit } from '../wideLayout';

export type DeckAction = {
  id: string;
  onPress: () => void;
  blockedReason?: string | null;
};

type TrainItem = {
  id: string;
  name: string;
  progress: number;
  resting: boolean;
  remainLabel: string;
  onPress: () => void;
};

type LearnedItem = {
  id: string;
  label: string;
  onPress: () => void;
};

type Props = {
  petName: string;
  reducedMotion: boolean;
  tummy: number;
  water: number;
  energy: number;
  mood: number;
  care: DeckAction[];
  bond: DeckAction[];
  style: DeckAction[];
  treatCount: number;
  asleep: boolean;
  playdateLabel: string;
  outfitLabel: string;
  training: TrainItem[];
  learned: LearnedItem[];
  onSchool: () => void;
  place: { id: string; name: string };
  onGoSomewhere: () => void;
  suggestedId: string | null;
  note: string | null;
  unwatchedPlaydates?: number;
};

function byId(list: DeckAction[], id: string): DeckAction | undefined {
  return list.find((item) => item.id === id);
}

export function HomeDeck(props: Props) {
  const { width, height } = useWindowDimensions();
  const split = isLandscapeSplit(width, height);
  const [tab, setTab] = useState<HomeTab>('care');
  const [toast, setToast] = useState<string | null>(null);
  const suggestedTab: HomeTab | null =
    props.suggestedId == null
      ? null
      : props.care.some((item) => item.id === props.suggestedId)
        ? 'care'
        : props.bond.some((item) => item.id === props.suggestedId)
          ? 'bond'
          : props.training.some((item) => item.id === props.suggestedId)
            ? 'train'
            : props.style.some((item) => item.id === props.suggestedId)
              ? 'style'
              : null;
  const alerts = new Set<HomeTab>();
  if (suggestedTab) {
    alerts.add(suggestedTab);
  }
  const unwatchedPlaydates = props.unwatchedPlaydates ?? 0;
  if (unwatchedPlaydates > 0) {
    alerts.add('bond');
  }

  const stateFor = (action: DeckAction | undefined): 'default' | 'suggested' | 'unavailable' => {
    if (!action) {
      return 'default';
    }
    if (action.blockedReason) {
      return 'unavailable';
    }
    if (action.id === props.suggestedId) {
      return 'suggested';
    }
    return 'default';
  };

  const feed = byId(props.care, 'feed');
  const water = byId(props.care, 'refill');
  const treat = byId(props.care, 'treat');
  const sleep = props.care.find((item) => item.id === 'rest' || item.id === 'wake');
  const tummyWord = needWord('tummy', props.tummy).replace('!', '').toLowerCase();

  return (
    <View style={styles.root}>
      <View style={[styles.pinned, split && styles.pinnedSplit]}>
        <StatStrip
          tummy={props.tummy}
          water={props.water}
          energy={props.energy}
          mood={props.mood}
          reducedMotion={props.reducedMotion}
        />
        <GoSomewhere
          petName={props.petName}
          placeId={props.place.id}
          placeName={props.place.name}
          reducedMotion={props.reducedMotion}
          onPress={props.onGoSomewhere}
        />
        <TabSwitcher value={tab} onChange={setTab} alerts={alerts} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}
        {props.note ? <Text style={styles.toast}>{props.note}</Text> : null}
        {tab === 'care' ? (
          <ActionGrid compact>
            <ActionCard
              icon={Utensils}
              title="Feed"
              size="quarter"
              sublabel={feed?.blockedReason ?? `${props.petName} is ${tummyWord}`}
              accent="care"
              state={stateFor(feed)}
              reducedMotion={props.reducedMotion}
              onPress={() => feed?.onPress()}
              onUnavailablePress={() => setToast(feed?.blockedReason ?? 'Not available right now')}
            />
            <ActionCard
              icon={Droplet}
              title="Water"
              size="quarter"
              sublabel={water?.blockedReason ?? needWord('water', props.water)}
              accent="care"
              state={stateFor(water)}
              reducedMotion={props.reducedMotion}
              onPress={() => water?.onPress()}
              onUnavailablePress={() => setToast(water?.blockedReason ?? 'Not available right now')}
            />
            <ActionCard
              icon={Bone}
              title="Treat"
              size="quarter"
              sublabel={`${props.treatCount} in bag`}
              accent="care"
              state={stateFor(treat)}
              reducedMotion={props.reducedMotion}
              onPress={() => treat?.onPress()}
            />
            <ActionCard
              icon={Moon}
              title={props.asleep ? 'Wake' : 'Sleep'}
              size="quarter"
              sublabel={props.asleep ? 'Wake up' : 'Rest up'}
              accent="care"
              state={stateFor(sleep)}
              reducedMotion={props.reducedMotion}
              onPress={() => sleep?.onPress()}
            />
          </ActionGrid>
        ) : null}
        {tab === 'bond' ? (
          <ActionGrid compact>
            <ActionCard
              icon={Heart}
              title="Cuddle"
              size="quarter"
              sublabel="Pat and cuddle"
              accent="bond"
              state={stateFor(byId(props.bond, 'cuddle'))}
              reducedMotion={props.reducedMotion}
              onPress={() => byId(props.bond, 'cuddle')?.onPress()}
            />
            <ActionCard
              icon={Sparkles}
              title="Play"
              size="quarter"
              sublabel="Throw a toy"
              accent="bond"
              state={stateFor(byId(props.bond, 'play'))}
              reducedMotion={props.reducedMotion}
              onPress={() => byId(props.bond, 'play')?.onPress()}
            />
            <ActionCard
              icon={Heart}
              title="Playdate"
              size="quarter"
              sublabel={props.playdateLabel}
              accent="bond"
              state={stateFor(byId(props.bond, 'playdate'))}
              reducedMotion={props.reducedMotion}
              badge={unwatchedPlaydates}
              onPress={() => byId(props.bond, 'playdate')?.onPress()}
            />
          </ActionGrid>
        ) : null}
        {tab === 'train' ? (
          <View style={styles.stack}>
            <Text style={styles.kicker}>IN TRAINING</Text>
            {props.training.length === 0 ? <Text style={styles.toast}>Nothing in training yet.</Text> : null}
            {props.training.map((row) => (
              <TrainingRow
                key={row.id}
                name={row.name}
                progress={row.progress}
                resting={row.resting}
                remainLabel={row.remainLabel}
                suggested={row.id === props.suggestedId}
                onPress={row.onPress}
              />
            ))}
            <Text style={styles.kicker}>LEARNED · TAP TO PERFORM</Text>
            <View style={styles.chips}>
              {props.learned.map((trick) => (
                <Pressable key={trick.id} accessibilityRole="button" onPress={trick.onPress} style={styles.chip}>
                  <Gloss radius={22} />
                  <Text style={styles.chipText}>{trick.label}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={props.onSchool} style={styles.chip}>
                <Gloss radius={22} />
                <Text style={styles.chipText}>More at Training School ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {tab === 'style' ? (
          <ActionGrid compact>
            <ActionCard
              icon={Shirt}
              title="Wardrobe"
              size="quarter"
              sublabel={props.outfitLabel}
              accent="style"
              state={stateFor(byId(props.style, 'wardrobe'))}
              reducedMotion={props.reducedMotion}
              onPress={() => byId(props.style, 'wardrobe')?.onPress()}
            />
            <ActionCard
              icon={Package}
              title="Storage"
              size="quarter"
              sublabel="Furniture and props"
              accent="style"
              state={stateFor(byId(props.style, 'storage'))}
              reducedMotion={props.reducedMotion}
              onPress={() => byId(props.style, 'storage')?.onPress()}
            />
            {byId(props.style, 'collection') ? (
              <ActionCard
                icon={Sparkles}
                title="Collection"
                size="quarter"
                sublabel="Park finds"
                accent="style"
                state={stateFor(byId(props.style, 'collection'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.style, 'collection')?.onPress()}
              />
            ) : null}
          </ActionGrid>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  pinned: {
    gap: 6,
    paddingHorizontal: ui.space.gutter,
    paddingTop: 8,
    // Phone: pull the strip up under the stage. Widescreen: the column clips, so stay flush.
    marginTop: -34,
  },
  pinnedSplit: {
    marginTop: 0,
    paddingTop: 12,
  },
  scroll: {
    padding: ui.space.gutter,
    gap: ui.space.gap,
    paddingBottom: 32,
  },
  stack: {
    gap: ui.space.gap,
  },
  kicker: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 12,
    letterSpacing: 0.6,
    color: ui.inkMuted,
  },
  toast: {
    fontFamily: fontFamily.semibold,
    fontSize: 13,
    color: ui.ink,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: ui.radius.pill,
    backgroundColor: ui.candy.train.base,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: ui.gloss.top,
    borderBottomWidth: 4,
    borderBottomColor: ui.candy.train.lip,
  },
  chipText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: candyInk(ui.candy.train),
  },
});
