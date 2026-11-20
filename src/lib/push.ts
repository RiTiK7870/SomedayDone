import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { ensureChannel, hasNotificationPermission } from './reminders';

export const NUDGE_CHANNEL_ID = 'nudges';

async function ensureNudgeChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL_ID, {
    name: 'Partner nudges',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#8B5CF6',
  });
}

// Saves this phone's push token, but only if notifications are already allowed.
// Never shows the system permission prompt by itself.
export async function registerPushIfAllowed(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!(await hasNotificationPermission())) return;

  await ensureChannel();
  await ensureNudgeChannel();

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_push_token', {
    p_token: pushToken,
    p_platform: Platform.OS,
  });
  if (error) throw error;
}
