import * as Notifications from 'expo-notifications';
import { Linking, Platform } from 'react-native';
import { AppError } from './errors';
import type { Frequency } from '../types';

const CHANNEL_ID = 'reminders';

// Show reminders as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Goal reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#8B5CF6',
  });
}

export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

// Asks the OS. Call only after the user has turned on a reminder and seen the explanation.
export async function requestNotificationPermission(): Promise<boolean> {
  if (await hasNotificationPermission()) return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Next time a reminder should fire. For daily reminders, the time of day is what matters.
export function nextFireDate(frequency: Frequency, stored: Date, now = new Date()): Date {
  if (frequency === 'once') return stored;
  const next = new Date(now);
  next.setHours(stored.getHours(), stored.getMinutes(), 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

export async function scheduleReminder(opts: {
  goalId: string;
  goalTitle: string;
  frequency: Frequency;
  fireAt: Date;
}): Promise<string> {
  const granted = await requestNotificationPermission();
  if (!granted) {
    throw new AppError('Notifications are off for SomedayDone. Turn them on in Android settings to get reminders.', 'PERMISSION_DENIED');
  }
  await ensureChannel();

  const trigger =
    opts.frequency === 'daily'
      ? {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: opts.fireAt.getHours(),
          minute: opts.fireAt.getMinutes(),
          channelId: CHANNEL_ID,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: opts.fireAt,
          channelId: CHANNEL_ID,
        };

  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'One small step today',
      body: opts.goalTitle,
      data: { goalId: opts.goalId },
    },
    trigger,
  });
}

export async function cancelReminder(notificationId: string | null | undefined): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined);
}

export async function cancelAllReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
}

export function openSystemNotificationSettings(): void {
  Linking.openSettings();
}
