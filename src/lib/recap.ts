import * as Notifications from 'expo-notifications';
import { CHANNEL_ID, ensureChannel, requestNotificationPermission } from './reminders';

const RECAP_ID = 'weekly-recap';

export async function isRecapOn(): Promise<boolean> {
  const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
  return all.some((n) => n.identifier === RECAP_ID);
}

// Schedules a repeating Sunday 6 pm notification, or cancels it. Returns whether it is on.
export async function setRecapOn(on: boolean): Promise<boolean> {
  await Notifications.cancelScheduledNotificationAsync(RECAP_ID).catch(() => undefined);
  if (!on) return false;

  const allowed = await requestNotificationPermission();
  if (!allowed) return false;

  await ensureChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: RECAP_ID,
    content: {
      title: 'Your week in SomedayDone',
      body: 'See the steps you finished and pick your next one.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 1 = Sunday
      hour: 18,
      minute: 0,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}
