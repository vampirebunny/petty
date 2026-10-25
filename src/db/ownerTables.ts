/** Every SQLite table that stores `owner_id`. Lines follow their transaction. `daily_counters` has no owner column. */
export const ownerIdTables = [
  'transactions',
  'balances',
  'inventory',
  'owner_state',
  'owned_toys',
  'owned_trick_props',
  'owned_furniture',
  'home_layouts',
  'shop_day',
  'shop_pick_history',
] as const;
