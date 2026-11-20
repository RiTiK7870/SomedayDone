import { supabase } from './supabase';
import { AppError, userMessage } from './errors';

export interface GoalPartner {
  id: string;
  goal_id: string;
  owner_id: string;
  partner_id: string | null;
  invite_email: string;
  status: 'pending' | 'accepted';
}

export interface IncomingInvite {
  id: string;
  goal_id: string;
  goals: { id: string; title: string; category: string } | null;
}

export interface SupportedGoal {
  id: string;
  goal_id: string;
  owner_id: string;
  goals: {
    id: string;
    title: string;
    category: string;
    status: string;
    goal_steps: { id: string; is_completed: boolean }[];
  } | null;
}

export interface OwnedPartnerRow {
  id: string;
  goal_id: string;
  invite_email: string;
  status: 'pending' | 'accepted';
  goal_title: string;
}

export interface NudgeItem {
  id: string;
  goal_id: string;
  from_id: string;
  created_at: string;
  goals: { title: string } | null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listPartnersForGoal(goalId: string): Promise<GoalPartner[]> {
  const { data, error } = await supabase
    .from('goal_partners')
    .select('id, goal_id, owner_id, partner_id, invite_email, status')
    .eq('goal_id', goalId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as GoalPartner[];
}

// Partners on goals this user owns. Owners can read their own goals, so the title joins cleanly.
export async function listOwnedPartners(userId: string): Promise<OwnedPartnerRow[]> {
  const { data, error } = await supabase
    .from('goal_partners')
    .select('id, goal_id, invite_email, status, goals(title)')
    .eq('owner_id', userId)
    .order('created_at');
  if (error) throw error;
  return (data ?? []).map((r: {
    id: string;
    goal_id: string;
    invite_email: string;
    status: 'pending' | 'accepted';
    goals: { title: string } | null;
  }) => ({
    id: r.id,
    goal_id: r.goal_id,
    invite_email: r.invite_email,
    status: r.status,
    goal_title: r.goals?.title ?? 'A goal',
  }));
}

export async function invitePartner(goalId: string, ownerId: string, rawEmail: string): Promise<void> {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new AppError('Enter a valid email address.');
  const { error } = await supabase
    .from('goal_partners')
    .insert({ goal_id: goalId, owner_id: ownerId, invite_email: email });
  if (error) {
    if (error.code === '23505') throw new AppError('You already invited this person to this goal.');
    throw error;
  }
}

export async function removePartner(id: string): Promise<void> {
  const { error } = await supabase.from('goal_partners').delete().eq('id', id);
  if (error) throw error;
}

// Invites come from a database function that checks the signed-in email on the server.
export async function listIncomingInvites(email: string): Promise<IncomingInvite[]> {
  if (!email) return [];
  const { data, error } = await supabase.rpc('list_my_invites');
  if (error) throw error;
  return (data ?? []).map((r: { id: string; goal_id: string; goal_title: string; goal_category: string }) => ({
    id: r.id,
    goal_id: r.goal_id,
    goals: { id: r.goal_id, title: r.goal_title, category: r.goal_category },
  }));
}

export async function acceptInvite(id: string): Promise<void> {
  const { error } = await supabase.rpc('accept_partner_invite', { p_id: id });
  if (error) throw error;
}

export async function declineInvite(id: string): Promise<void> {
  const { error } = await supabase.from('goal_partners').delete().eq('id', id);
  if (error) throw error;
}

// Partners read goal details through a function that returns approved fields only.
export async function listSupportedGoals(userId: string): Promise<SupportedGoal[]> {
  const { data: links, error } = await supabase
    .from('goal_partners')
    .select('id, goal_id, owner_id')
    .eq('partner_id', userId)
    .eq('status', 'accepted');
  if (error) throw error;

  return Promise.all(
    (links ?? []).map(async (link) => {
      const { data, error: goalError } = await supabase.rpc('get_partner_goal', { p_goal: link.goal_id });
      if (goalError) throw goalError;
      const g = data as {
        title: string;
        category: string;
        status: string;
        steps: { id: string; is_completed: boolean }[];
      } | null;
      return {
        id: link.id,
        goal_id: link.goal_id,
        owner_id: link.owner_id,
        goals: g
          ? {
              id: link.goal_id,
              title: g.title,
              category: g.category,
              status: g.status,
              goal_steps: (g.steps ?? []).map((st) => ({ id: st.id, is_completed: st.is_completed })),
            }
          : null,
      } as SupportedGoal;
    }),
  );
}

export async function sendNudge(goalId: string, fromId: string, toId: string): Promise<void> {
  // The database function checks each rule and returns a clear message when one fails.
  const { data, error } = await supabase.rpc('send_nudge', { p_goal: goalId, p_to: toId });
  if (error) {
    const code = (error as { code?: string }).code ?? '';
    if (['28000', '22023', '42501', 'P0001'].includes(code)) {
      throw new AppError(error.message);
    }
    throw error;
  }

  // The nudge is already saved. The phone push is best-effort and does not block the user.
  void supabase.functions
    .invoke('notify-nudge', { body: { nudgeId: data as string } })
    .catch(() => undefined);
}

export async function listNudgesForMe(userId: string): Promise<NudgeItem[]> {
  const { data, error } = await supabase
    .from('partner_nudges')
    .select('id, goal_id, from_id, created_at')
    .eq('to_id', userId)
    .is('seen_at', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;

  const goalIds = Array.from(new Set((data ?? []).map((n) => n.goal_id as string)));
  const titles = new Map<string, string>();
  if (goalIds.length > 0) {
    const { data: rows, error: titleError } = await supabase.rpc('get_goal_titles', { p_ids: goalIds });
    if (titleError) throw titleError;
    for (const r of (rows ?? []) as { id: string; title: string }[]) titles.set(r.id, r.title);
  }

  return (data ?? []).map((n) => ({
    ...n,
    goals: titles.has(n.goal_id) ? { title: titles.get(n.goal_id) as string } : null,
  })) as NudgeItem[];
}

export async function markNudgesSeen(userId: string): Promise<void> {
  const { error } = await supabase
    .from('partner_nudges')
    .update({ seen_at: new Date().toISOString() })
    .eq('to_id', userId)
    .is('seen_at', null);
  if (error) throw error;
}

// Turns a database error into a message. Missing setup names the missing object, so it can be fixed.
export function partnerErrorMessage(e: unknown): string {
  const code = (e as { code?: string } | null)?.code ?? '';
  const message = (e as { message?: string } | null)?.message ?? '';

  // Our own rule messages (for example, the one-nudge-per-hour limit) are safe to show.
  if (code === 'P0001') return message;

  // Missing function (PGRST202 / 42883) or missing table (42P01 / PGRST205).
  const fn = message.match(/function (?:public\.)?(\w+)\(/) ?? message.match(/Could not find the function (?:public\.)?(\w+)/);
  if (fn) return `Partner setup is incomplete: database function ${fn[1]} is missing. Re-run the setup scripts in Supabase.`;
  const table = message.match(/relation "?(?:public\.)?(\w+)"? does not exist/) ?? message.match(/Could not find the table '(?:public\.)?(\w+)'/);
  if (table) return `Partner setup is incomplete: table ${table[1]} is missing. Re-run the setup scripts in Supabase.`;

  if (code === '42P01' || code === 'PGRST205' || /schema cache|does not exist/i.test(message)) {
    return 'Partner sharing is not set up on the server yet. Re-run the setup scripts in Supabase.';
  }
  if (code === '42501') {
    return 'Blocked by the database rules (code 42501). Check that the setup scripts ran fully.';
  }
  const generic = userMessage(e);
  if (generic !== 'Something went wrong. Please try again.') return generic;
  return code
    ? `Something went wrong (code ${code}). Please send this code to the developer.`
    : generic;
}
