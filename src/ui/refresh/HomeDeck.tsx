import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';
import { Bone, Droplet, Heart, Moon, Package, Shirt, Sparkles, Utensils } from 'lucide-react-native';

import { fontFamily } from '../font';
import { ActionCard, ActionGrid } from './ActionCard';
import { needWord, StatStrip } from './StatStrip';
import { TabSwitcher, type HomeTab } from './TabSwitcher';
import { TrainingRow } from './TrainingRow';
import { ui } from './tokens';

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
  suggestedId: string | null;
  note: string | null;
};

function byId(list: DeckAction[], id: string): DeckAction | undefined {
  return list.find((item) => item.id === id);
}

export function HomeDeck(props: Props) {
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
      <View style={styles.pinned}>
        <StatStrip
          tummy={props.tummy}
          water={props.water}
          energy={props.energy}
          mood={props.mood}
          reducedMotion={props.reducedMotion}
        />
        <TabSwitcher value={tab} onChange={setTab} alerts={alerts} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}
        {props.note ? <Text style={styles.toast}>{props.note}</Text> : null}
        {tab === 'care' ? (
          <ActionGrid>
            <ActionCard
              icon={Utensils}
              title="Feed"
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
              sublabel={`${props.treatCount} in your bag`}
              accent="care"
              state={stateFor(treat)}
              reducedMotion={props.reducedMotion}
              onPress={() => treat?.onPress()}
            />
            <ActionCard
              icon={Moon}
              title={props.asleep ? 'Wake' : 'Sleep'}
              sublabel={props.asleep ? 'Wake up' : 'Restores energy'}
              accent="care"
              state={stateFor(sleep)}
              reducedMotion={props.reducedMotion}
              onPress={() => sleep?.onPress()}
            />
          </ActionGrid>
        ) : null}
        {tab === 'bond' ? (
          <View style={styles.stack}>
            <ActionGrid>
              <ActionCard
                icon={Heart}
                title="Cuddle"
                sublabel="A pat and a cuddle"
                accent="bond"
                state={stateFor(byId(props.bond, 'cuddle'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.bond, 'cuddle')?.onPress()}
              />
              <ActionCard
                icon={Sparkles}
                title="Play"
                sublabel="Throw a toy"
                accent="bond"
                state={stateFor(byId(props.bond, 'play'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.bond, 'play')?.onPress()}
              />
            </ActionGrid>
            <ActionCard
              icon={Heart}
              title="Playdate"
              sublabel={props.playdateLabel}
              accent="bond"
              size="full"
              state={stateFor(byId(props.bond, 'playdate'))}
              reducedMotion={props.reducedMotion}
              onPress={() => byId(props.bond, 'playdate')?.onPress()}
            />
          </View>
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
                  <Text style={styles.chipText}>{trick.label}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="button" onPress={props.onSchool} style={styles.chip}>
                <Text style={styles.chipText}>More at Training School ›</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {tab === 'style' ? (
          <View style={styles.stack}>
            <ActionGrid>
              <ActionCard
                icon={Shirt}
                title="Wardrobe"
                sublabel={props.outfitLabel}
                accent="style"
                state={stateFor(byId(props.style, 'wardrobe'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.style, 'wardrobe')?.onPress()}
              />
              <ActionCard
                icon={Package}
                title="Storage"
                sublabel="Food, treats and toys"
                accent="style"
                state={stateFor(byId(props.style, 'storage'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.style, 'storage')?.onPress()}
              />
            </ActionGrid>
            {byId(props.style, 'collection') ? (
              <ActionCard
                icon={Sparkles}
                title="Collection"
                sublabel={`Everything ${props.petName} has found`}
                accent="style"
                size="full"
                state={stateFor(byId(props.style, 'collection'))}
                reducedMotion={props.reducedMotion}
                onPress={() => byId(props.style, 'collection')?.onPress()}
              />
            ) : null}
          </View>
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
    gap: ui.space.gap,
    paddingHorizontal: ui.space.gutter,
    paddingTop: 8,
    marginTop: -34,
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
    backgroundColor: ui.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontFamily: fontFamily.fredokaSemibold,
    fontSize: 14,
    color: ui.ink,
  },
});
