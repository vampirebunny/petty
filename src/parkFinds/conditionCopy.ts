import type { ParkFindConditionType } from './types';

export type ConditionCopy = {
  modalLine: string | null;
  icon: string | null;
  label: string | null;
};

const table: Record<string, ConditionCopy> = {
  'always:': { modalLine: null, icon: null, label: null },
  'season:spring': { modalLine: 'Found in spring', icon: 'blossom', label: 'Spring' },
  'season:summer': { modalLine: 'Found in summer', icon: 'sun', label: 'Summer' },
  'season:fall': { modalLine: 'Found in fall', icon: 'leaf', label: 'Fall' },
  'season:autumn': { modalLine: 'Found in fall', icon: 'leaf', label: 'Fall' },
  'season:winter': { modalLine: 'Found in winter', icon: 'snowflake', label: 'Winter' },
  'weather:rain': { modalLine: 'Found in the rain', icon: 'raindrop', label: 'Rain' },
  'weather:snow': { modalLine: 'Found in the snow', icon: 'snow-cloud', label: 'Snow' },
  'weather:rainbow': { modalLine: 'Found under a rainbow', icon: 'rainbow', label: 'Rainbow' },
  'time:dawn': { modalLine: 'Found at dawn', icon: 'sunrise', label: 'Dawn' },
  'time:night': { modalLine: 'Found at night', icon: 'moon', label: 'Night' },
  'moon:full': { modalLine: 'Found under a full moon', icon: 'full-moon', label: 'Full moon' },
  'date_window:02-10..02-14': {
    modalLine: "Found around Valentine's Day",
    icon: 'calendar',
    label: 'Feb 10–14',
  },
  'date_window:10-25..10-31': {
    modalLine: 'Found around Halloween',
    icon: 'calendar',
    label: 'Oct 25–31',
  },
  'date_window:12-20..12-26': {
    modalLine: 'Found during the holidays',
    icon: 'calendar',
    label: 'Dec 20–26',
  },
  'date_window:12-31..01-01': {
    modalLine: "Found at New Year's",
    icon: 'calendar',
    label: 'Dec 31–Jan 1',
  },
};

export function conditionKey(type: ParkFindConditionType, value: string | null): string {
  return `${type}:${value ?? ''}`;
}

export function conditionCopyFor(
  type: ParkFindConditionType,
  value: string | null,
): ConditionCopy {
  return table[conditionKey(type, value)] ?? { modalLine: null, icon: null, label: null };
}
