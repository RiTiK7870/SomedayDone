import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { Goal } from '../types';
import { supabase } from './supabase';
import { AppError } from './errors';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: IconName;
  unlocked: boolean;
}

export function computeBadges(goals: Goal[], longestRun: number): Badge[] {
  const doneSteps = goals.reduce(
    (n, g) => n + g.goal_steps.filter((s) => s.is_completed).length,
    0,
  );
  const finished = goals.filter((g) => g.status === 'completed').length;

  return [
    { id: 'first-step', title: 'First step', description: 'Completed your first step', icon: 'footsteps', unlocked: doneSteps >= 1 },
    { id: 'ten-steps', title: 'Ten steps', description: 'Completed 10 steps', icon: 'trail-sign', unlocked: doneSteps >= 10 },
    { id: 'fifty-steps', title: 'Fifty steps', description: 'Completed 50 steps', icon: 'trophy', unlocked: doneSteps >= 50 },
    { id: 'finisher', title: 'Dream finished', description: 'Completed a whole goal', icon: 'ribbon', unlocked: finished >= 1 },
    { id: 'dreamer', title: 'Dreamer', description: 'Started 5 goals', icon: 'flag', unlocked: goals.length >= 5 },
    { id: 'streak-3', title: 'On a roll', description: '3 days in a row', icon: 'flame', unlocked: longestRun >= 3 },
    { id: 'streak-7', title: 'Unstoppable', description: '7 days in a row', icon: 'rocket', unlocked: longestRun >= 7 },
  ];
}

// The server checks the user's goals and stores any badges they have earned.
// Earned badges are never taken back. The app cannot write badges directly.
export async function syncBadges(): Promise<string[]> {
  const { data, error } = await supabase.functions.invoke('award-badges', {
    body: { tzOffsetMinutes: new Date().getTimezoneOffset() },
  });
  if (error) throw new AppError('Could not update badges right now.');
  return (data as { earned?: string[] } | null)?.earned ?? [];
}
