import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type * as NotificationsModule from 'expo-notifications';
import { Linking, Platform } from 'react-native';

import { api } from '@/core/api/client';
import { getToken } from '@/core/auth/storage';

// Native push via Expo push tokens, registered on the backend at
// /api/app-push (website/node: appPushController.js). The website/TWA keep
// their own Web Push subscriptions; nothing here touches those.

// Must match ANDROID_CHANNEL in the backend's expoPushHelper.js.
const ANDROID_CHANNEL = 'default';

export type PushStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

// expo-notifications' native module is missing from Expo Go (and from any
// build made before it was installed); importing it there throws "Cannot find
// native module 'ExpoTopicSubscriptionModule'" and takes the whole app down.
// Load it lazily so those builds simply run without push.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function loadNotifications(): typeof NotificationsModule | null {
  if (Platform.OS === 'web' || isExpoGo) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications');
  } catch {
    return null;
  }
}

const Notifications = loadNotifications();

// Show notifications that arrive while the app is open, too.
Notifications?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

// Push needs the native module and a real device.
const supported = () => !!Notifications && Device.isDevice;

async function ensureChannel() {
  // Android 13+ shows the permission prompt only once a channel exists.
  if (!Notifications || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: 'Orders & offers',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#0066CC',
  });
}

const isGranted = (p: NotificationsModule.NotificationPermissionsStatus) =>
  p.granted || p.ios?.status === Notifications?.IosAuthorizationStatus.PROVISIONAL;

export async function getPushStatus(): Promise<PushStatus> {
  if (!supported()) return 'unavailable';
  const p = await Notifications!.getPermissionsAsync();
  if (isGranted(p)) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

// The last token registered, and for which session: the same pair is never
// sent twice (sign-in/out changes the session, so that still re-registers).
let lastSent = '';

export async function registerToken(token: string) {
  const key = `${token}|${(await getToken()) ?? ''}`;
  if (key === lastSent) return;
  lastSent = key;
  await api
    .post('/api/app-push/register', {
      token,
      platform: Platform.OS,
      app_version: Constants.expoConfig?.version ?? null,
      device_name: Device.modelName ?? null,
    })
    .catch((e) => {
      lastSent = ''; // not sent after all: let the next sync retry
      throw e;
    });
}

// Registers this device's token with the backend (and so with whoever is
// signed in right now). `prompt` asks for permission if it hasn't been asked
// yet; without it this only re-syncs a device that already said yes.
export async function syncPush({ prompt = false }: { prompt?: boolean } = {}): Promise<PushStatus> {
  if (!supported()) return 'unavailable';
  try {
    await ensureChannel();
    let status = await getPushStatus();
    if (status === 'undetermined' && prompt) {
      status = isGranted(await Notifications!.requestPermissionsAsync()) ? 'granted' : 'denied';
    }
    if (status !== 'granted') return status;

    if (!projectId) {
      if (__DEV__) console.warn('Push: no EAS projectId in app.json (run `eas init`), skipping token registration.');
      return 'granted';
    }
    // Rejects when offline.
    const { data } = await Notifications!.getExpoPushTokenAsync({ projectId });
    await registerToken(data);
    return 'granted';
  } catch (e) {
    if (__DEV__) console.warn('Push sync failed:', e);
    return getPushStatus().catch(() => 'unavailable' as const);
  }
}

const urlOf = (r: NotificationsModule.NotificationResponse | null | undefined) => {
  const url = r?.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
};

// Tapped notifications: `onUrl` gets the notification's website path, both
// for the tap that launched the app and for taps while it's running. Also
// re-registers the token when Expo rotates it. Returns a cleanup function.
export function watchNotifications(onUrl: (url: string) => void) {
  if (!Notifications) return () => {};

  Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      const url = urlOf(r);
      if (url) onUrl(url);
    })
    .catch(() => {});

  const tap = Notifications.addNotificationResponseReceivedListener((r) => {
    const url = urlOf(r);
    if (url) onUrl(url);
  });
  // Android reports the device token here every time one is fetched,
  // including by getExpoPushTokenAsync itself, so re-fetching on every event
  // fed itself: one registration per round trip for as long as the app was
  // open (70+ in 15 s), which starved every other request. Only a device
  // token we haven't seen is a real rotation.
  let lastDevice: string | null = null;
  const rotate = Notifications.addPushTokenListener(({ data }) => {
    const device = String(data);
    if (device === lastDevice) return;
    lastDevice = device;
    Notifications.getExpoPushTokenAsync({ projectId })
      .then(({ data }) => registerToken(data))
      .catch(() => {});
  });
  return () => {
    tap.remove();
    rotate.remove();
  };
}

// After "Don't allow", only the system settings can turn notifications on.
export const openNotificationSettings = () => Linking.openSettings().catch(() => {});
