import { Alert, Share } from 'react-native';
import type { Goal } from '../types';
import { progressFor } from './goals';
import { getPublicPage, publicPageUrl } from './publicPage';
import { userMessage } from './errors';

// Shares a text progress card. Adds the public page link when the user has one.
export async function shareGoalProgress(goal: Goal, userId?: string): Promise<void> {
  const p = progressFor(goal);
  const filled = p.percent === null ? 0 : Math.round(p.percent / 10);
  const bar = '■'.repeat(filled) + '□'.repeat(10 - filled);

  let link: string | null = null;
  if (userId) {
    try {
      const page = await getPublicPage(userId);
      if (page.isPublic && page.slug) link = publicPageUrl(page.slug);
    } catch {
      link = null;
    }
  }

  const lines = [
    `My someday dream: ${goal.title}`,
    p.percent === null
      ? 'Just getting started.'
      : `${bar}  ${p.percent}% (${p.done} of ${p.total} steps)`,
    goal.status === 'completed'
      ? 'Done. One dream off the list.'
      : 'Working on it, one small step at a time.',
    link ? `Follow along: ${link}` : '',
    '#SomedayDone',
  ].filter(Boolean);

  try {
    await Share.share({ message: lines.join('\n') });
  } catch (e) {
    Alert.alert('Could not share', userMessage(e));
  }
}
