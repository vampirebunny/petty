import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

import { resetPurchasesUserForTests, syncPurchasesUser } from '../purchasesUser';

jest.mock('expo', () => ({
  isRunningInExpoGo: jest.fn(() => false),
}));

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    setLogLevel: jest.fn(async () => undefined),
    LOG_LEVEL: { DEBUG: 'DEBUG' },
    isConfigured: jest.fn(async () => false),
    getAppUserID: jest.fn(async () => 'user-a'),
    logIn: jest.fn(async () => ({ customerInfo: {}, created: false })),
    logOut: jest.fn(),
  },
}));

const iosKey = 'EXPO_PUBLIC_REVENUECAT_IOS_KEY';
const androidKey = 'EXPO_PUBLIC_REVENUECAT_ANDROID_KEY';

function keyName(): string {
  return Platform.OS === 'android' ? androidKey : iosKey;
}

beforeEach(() => {
  resetPurchasesUserForTests();
  jest.mocked(Purchases.configure).mockClear();
  jest.mocked(Purchases.logIn).mockClear();
  jest.mocked(Purchases.logOut).mockClear();
  jest.mocked(Purchases.isConfigured).mockReset();
  jest.mocked(Purchases.isConfigured).mockResolvedValue(false);
  jest.mocked(Purchases.getAppUserID).mockReset();
  jest.mocked(Purchases.getAppUserID).mockResolvedValue('user-a');
  delete process.env[iosKey];
  delete process.env[androidKey];
  jest.mocked(isRunningInExpoGo).mockReturnValue(false);
});

it('does not configure without an id', async () => {
  process.env[keyName()] = 'public_key';
  await syncPurchasesUser(null);
  expect(Purchases.configure).not.toHaveBeenCalled();
  expect(Purchases.logIn).not.toHaveBeenCalled();
  expect(Purchases.logOut).not.toHaveBeenCalled();
});

it('does not configure without a public SDK key', async () => {
  await syncPurchasesUser('user-a');
  expect(Purchases.configure).not.toHaveBeenCalled();
});

it('configures with the auth user id and logs in only when that id changes', async () => {
  process.env[keyName()] = 'public_key';
  await syncPurchasesUser('user-a');
  await syncPurchasesUser('user-a');
  await syncPurchasesUser('user-b');
  expect(Purchases.configure).toHaveBeenCalledTimes(1);
  expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'public_key', appUserID: 'user-a' });
  expect(Purchases.logIn).toHaveBeenCalledTimes(1);
  expect(Purchases.logIn).toHaveBeenCalledWith('user-b');
  expect(Purchases.logOut).not.toHaveBeenCalled();
});

it('lets a guest buy under the install id, then follows a later account id', async () => {
  process.env[keyName()] = 'public_key';
  await syncPurchasesUser('install-1');
  await syncPurchasesUser('user-a');
  expect(Purchases.configure).toHaveBeenCalledWith({ apiKey: 'public_key', appUserID: 'install-1' });
  expect(Purchases.logIn).toHaveBeenCalledTimes(1);
  expect(Purchases.logIn).toHaveBeenCalledWith('user-a');
  expect(Purchases.logOut).not.toHaveBeenCalled();
});

it('does not configure in Expo Go', async () => {
  jest.mocked(isRunningInExpoGo).mockReturnValue(true);
  process.env[keyName()] = 'public_key';
  await syncPurchasesUser('user-a');
  expect(Purchases.configure).not.toHaveBeenCalled();
  expect(Purchases.logIn).not.toHaveBeenCalled();
});

it('keeps going when configure rejects the key', async () => {
  process.env[keyName()] = 'public_key';
  jest.mocked(Purchases.configure).mockImplementation(() => {
    throw new Error('Invalid API key');
  });
  await expect(syncPurchasesUser('user-a')).resolves.toBeUndefined();
  await syncPurchasesUser('user-a');
  expect(Purchases.configure).toHaveBeenCalledTimes(2);
  expect(Purchases.logIn).not.toHaveBeenCalled();
});

it('logs into an already configured SDK instead of configuring again', async () => {
  process.env[keyName()] = 'public_key';
  jest.mocked(Purchases.isConfigured).mockResolvedValue(true);
  jest.mocked(Purchases.getAppUserID).mockResolvedValue('$RCAnonymousID');
  await syncPurchasesUser('user-a');
  expect(Purchases.configure).not.toHaveBeenCalled();
  expect(Purchases.logIn).toHaveBeenCalledWith('user-a');
  expect(Purchases.logOut).not.toHaveBeenCalled();
});
