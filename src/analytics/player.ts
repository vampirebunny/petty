import { breedById } from '../actor/breeds';
import { readAccountLinked } from '../db/accountMeta';
import { getCachedUserId } from '../compliance/identity';
import { iapPurchaseKeys } from '../economy/iapApply';
import { loadFriends } from '../friends/api';
import { stageOf } from '../sim/attributes';
import type { PetState } from '../sim/types';
import { bucketFriends, bucketLevel, setPlayer, setProp } from './analytics';

export function syncAnalyticsIdentity(): void {
  const id = getCachedUserId();
  if (id) {
    setPlayer(id);
  }
}

export function syncAnalyticsProps(pet: PetState | null): void {
  if (!pet) {
    return;
  }
  const breed = breedById(pet.breedId);
  if (breed) {
    setProp('species', breed.species);
  }
  setProp('breed', pet.breedId);
  setProp('archetype', pet.attributes.archetype);
  setProp('life_stage', stageOf(pet.ageDays));
  setProp('pet_level_bucket', bucketLevel(pet.level));
  setProp('has_account', readAccountLinked() ? 'yes' : 'no');
  setProp('is_payer', iapPurchaseKeys().length > 0 ? 'yes' : 'no');
}

export function syncFriendBucket(): void {
  void loadFriends().then((bundle) => {
    setProp('friend_count_bucket', bucketFriends(bundle.friends.length));
  });
}
