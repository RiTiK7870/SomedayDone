export const CATEGORIES = [
  'Personal Growth',
  'Travel',
  'Fitness',
  'Career',
  'Learning',
  'Experiences',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const STATUSES = ['not_started', 'in_progress', 'completed', 'archived'] as const;
export type GoalStatus = (typeof STATUSES)[number];

export const STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
  archived: 'Archived',
};

export type Frequency = 'once' | 'daily';

export interface Step {
  id: string;
  goal_id: string;
  title: string;
  is_completed: boolean;
  position: number;
  completed_at: string | null;
}

export interface Reminder {
  id: string;
  goal_id: string;
  user_id: string;
  reminder_time: string;
  frequency: Frequency;
  timezone: string;
  is_enabled: boolean;
  notification_id: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: Category;
  target_date: string | null;
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  goal_steps: Step[];
  reminders: Reminder[];
}

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}
