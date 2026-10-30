import type { PURCHASES_ERROR_CODE } from 'react-native-purchases';
import type { Stage, OutfitSlot } from '../sim/types';
import type { RoadSpot } from '../sim/road';
import type { HomeRoom } from '../ui/town/rooms';
import type { RaceEvent, RaceClass, RaceCup } from '../sim/stadium';
import type { ItemKind as CatalogItemKind } from '../economy/catalog';
import type { ShopCategory } from '../economy/shop';
import type { AccountSheetReason } from '../ui/AccountSheet';
import type { ParkFindRarity } from '../sim/parkFindsConfig';

export type Species = 'dog' | 'cat';
export type LifeStage = Stage;
export type MapSpot = RoadSpot;
export type Room = HomeRoom['id'];
export type Place = MapSpot | Room;
export type MiniGameId = 'paddlePaws' | 'cloudHop' | 'stay';
// Tutorial actions are gameplayConfig.goals. Daily slots add hat, park, and find.
// park and parkFind stay distinct. Prefixed slots log the prefix only.
export type ActivityId =
  | 'feed'
  | 'water'
  | 'school'
  | 'play'
  | 'nap'
  | 'parkFind'
  | 'pat'
  | 'cuddle'
  | 'closet'
  | 'sit'
  | 'race'
  | 'friendGame'
  | 'hat'
  | 'park'
  | 'find'
  | 'toy'
  | 'practice'
  | 'progress';
export type SpendCategory = CatalogItemKind | 'trick';
export type ShopSection = 'picks' | 'limited' | 'bundle' | 'collection' | ShopCategory;
export type PromptReason = Exclude<AccountSheetReason, 'restore' | 'reauth' | 'apple_reauth'>;
export type EarnSource =
  | 'away_payout'
  | 'session_accrual'
  | 'starter'
  | 'life_stage'
  | 'trick_mastered'
  | 'iap'
  | 'level_up'
  | 'daily_login'
  | 'welcome_back'
  | 'playdate'
  | 'play_find';
export type HoursAway = '5m-1h' | '1-5' | '5-12' | '12-24' | '24-72' | '72+';
export type OnboardingStep = 'consent_accepted' | 'adopt' | 'attributes' | 'name' | 'meet' | 'home';
export type IapContext = 'petShop' | 'insufficient_boops';
export type BlockContext = 'petShop' | 'trickShop' | 'furnitureBundle';
export type TreatContext = 'training' | 'care' | 'shop';
export type NotifContext = 'friends' | 'race' | 'care';
export type PlaydatePartner = 'npc' | 'friend' | 'retired';
export type Screen =
  | 'welcome'
  | 'consent'
  | 'adopt'
  | 'meet'
  | Room
  | Exclude<MapSpot, 'home'>
  | 'map'
  | 'closet'
  | 'storage'
  | 'collection'
  | 'race'
  | 'minigame'
  | 'petCam'
  | 'settings'
  | 'friends';

export type Bit = 0 | 1;
export type NoParams = Record<string, never>;

export type AnalyticsEvents = {
  onboarding_step: { step: OnboardingStep };
  pet_adopted: { species: Species; breed: string; coat_style: string; eye_color: string; archetype: string };
  tutorial_begin: NoParams;
  tutorial_complete: NoParams;
  suggested_activity_complete: { activity_id: ActivityId; list: 'tutorial' | 'daily'; pet_level: number };

  app_return: { hours_away: HoursAway; tummy: number; energy: number; mood: number; boops_paid: number };
  care_action: { action: 'feed' | 'water' | 'treat' | 'bed' | 'cuddle'; stat_before: number; item_id?: string };
  toy_play: { toy_id: string; place: Place };
  location_visit: { place: Place };
  level_up: { level: number; character: Species };
  unlock_achievement: { achievement_id: string; tier?: number };
  pet_cam_shown: { clip_id: string; night: Bit };
  pet_cam_played: { clip_id: string; night: Bit };
  park_find: { item_id: string; rarity: ParkFindRarity; first_time: Bit };
  collection_open: { found_count: number };
  closet_equip: { slot: OutfitSlot; item_id: string; action: 'on' | 'off' };

  trick_attempt: { trick_id: string; success: Bit; treat_given: Bit; at_school: Bit };
  trick_learned: { trick_id: string; attempts_total: number; days_to_learn: number };
  training_break: { trick_id: string; second_wind_owned: number };
  second_wind_used: { trick_id: string };

  earn_virtual_currency: { virtual_currency_name: 'Boops'; value: number; source: EarnSource };
  spend_virtual_currency: {
    virtual_currency_name: 'Boops';
    value: number;
    item_name: string;
    category: SpendCategory;
  };
  shop_item_view: { item_id: string; section: ShopSection };
  shop_try_on: { item_id: string };
  shop_add_to_cart: { item_id: string; price_boops: number; section: ShopSection };
  shop_checkout: { total_boops: number; item_count: number };
  insufficient_boops: { context: BlockContext; shortfall: number };
  out_of_treats: { context: TreatContext };

  iap_view: { context: IapContext };
  iap_pack_tap: { pack_id: string };
  iap_result: { pack_id: string; result: 'success' | 'cancelled' | 'failed'; error_code?: PURCHASES_ERROR_CODE };

  account_prompt: { reason: PromptReason; result: 'accepted' | 'dismissed' };
  sign_up: { method: 'apple' | 'google' };
  login: { method: 'apple' | 'google' };
  notif_permission: { context: NotifContext; granted: Bit };
  friend_request_sent: { via: 'handle' | 'qr' };
  friend_request_response: { result: 'accept' | 'decline' | 'block' };
  share: { content_type: 'invite'; completed: Bit };
  playdate_start: { partner_type: PlaydatePartner; friend_count: number };
  playdate_complete: { partner_type: PlaydatePartner; friend_count: number };

  minigame_start: { game_id: MiniGameId };
  minigame_end: { game_id: MiniGameId; score: number; duration_s: number };
  post_score: { game_id: MiniGameId; score: number };
  competition_enter: { type: RaceEvent; class: RaceClass; cup: RaceCup; live_players: number };
  competition_result: { type: RaceEvent; class: RaceClass; cup: RaceCup; placement: number; ribbon: Bit };
  competition_blocked: { type: RaceEvent; missing_trick: string };
};

export type UserProps = {
  species: Species;
  breed: string;
  archetype: string;
  life_stage: LifeStage;
  pet_level_bucket: '1-2' | '3-5' | '6-10' | '11-20' | '21+';
  has_account: 'yes' | 'no';
  is_payer: 'yes' | 'no';
  friend_count_bucket: '0' | '1-2' | '3-5' | '6+';
};

const activityIds: readonly ActivityId[] = [
  'feed',
  'water',
  'school',
  'play',
  'nap',
  'parkFind',
  'pat',
  'cuddle',
  'closet',
  'sit',
  'race',
  'friendGame',
  'hat',
  'park',
  'find',
  'toy',
  'practice',
  'progress',
];

export function activityIdOf(slotId: string): ActivityId | null {
  const raw = slotId.startsWith('tutorial:') ? slotId.slice('tutorial:'.length) : slotId;
  if (raw.startsWith('toy:')) {
    return 'toy';
  }
  if (raw.startsWith('practice:')) {
    return 'practice';
  }
  if (raw.startsWith('progress:')) {
    return 'progress';
  }
  return activityIds.includes(raw as ActivityId) ? (raw as ActivityId) : null;
}
