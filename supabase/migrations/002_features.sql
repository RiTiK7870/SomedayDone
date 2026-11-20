-- SomedayDone features: public dream pages, accountability partners, and nudges.
-- Apply after 001_init.sql with: supabase db push  (or paste into the SQL editor).

-- ---------- Public dream page ----------

alter table public.profiles
  add column if not exists public_slug text unique
    check (public_slug is null or public_slug ~ '^[a-z0-9-]{3,30}$'),
  add column if not exists is_public boolean not null default false;

-- ---------- Accountability partners ----------

create table if not exists public.goal_partners (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  partner_id   uuid references auth.users(id) on delete cascade,
  invite_email text not null
    check (position('@' in invite_email) > 1 and invite_email = lower(invite_email)),
  status       text not null default 'pending' check (status in ('pending','accepted')),
  created_at   timestamptz not null default now(),
  unique (goal_id, invite_email)
);
create index if not exists goal_partners_partner_idx on public.goal_partners (partner_id, status);
create index if not exists goal_partners_email_idx on public.goal_partners (invite_email, status);

create table if not exists public.partner_nudges (
  id         uuid primary key default gen_random_uuid(),
  goal_id    uuid not null references public.goals(id) on delete cascade,
  from_id    uuid not null references auth.users(id) on delete cascade,
  to_id      uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists partner_nudges_to_idx on public.partner_nudges (to_id, seen_at);

alter table public.goal_partners  enable row level security;
alter table public.partner_nudges enable row level security;

-- Helper functions run as the owner so policies can check ownership without
-- recursing through each other's row-level security.
create or replace function public.is_goal_owner(p_goal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.goals g where g.id = p_goal and g.user_id = auth.uid());
$$;

create or replace function public.is_accepted_partner(p_goal uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.goal_partners gp
    where gp.goal_id = p_goal and gp.partner_id = auth.uid() and gp.status = 'accepted'
  );
$$;

-- Owners manage their own invites.
create policy "goal_partners: owner manages"
  on public.goal_partners for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_goal_owner(goal_id));

-- The invited email (or the accepted partner) can see the invite.
create policy "goal_partners: invitee reads"
  on public.goal_partners for select to authenticated
  using (partner_id = auth.uid() or invite_email = lower(auth.jwt() ->> 'email'));

-- The invited email can decline by deleting the invite.
create policy "goal_partners: invitee declines"
  on public.goal_partners for delete to authenticated
  using (invite_email = lower(auth.jwt() ->> 'email'));

-- Accepting goes through this function, so a partner can only claim an invite sent to their email.
create or replace function public.accept_partner_invite(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.goal_partners
     set partner_id = auth.uid(), status = 'accepted'
   where id = p_id
     and status = 'pending'
     and owner_id <> auth.uid()
     and invite_email = lower(auth.jwt() ->> 'email');
  if not found then
    raise exception 'This invite is no longer available.';
  end if;
end;
$$;

revoke execute on function public.accept_partner_invite(uuid) from public, anon;
grant execute on function public.accept_partner_invite(uuid) to authenticated;

-- Partners and invited users can read the goal they were invited to.
create policy "goals: accepted partners read"
  on public.goals for select to authenticated
  using (public.is_accepted_partner(id));

create policy "goals: invited users see the invite"
  on public.goals for select to authenticated
  using (exists (
    select 1 from public.goal_partners gp
    where gp.goal_id = goals.id and gp.invite_email = lower(auth.jwt() ->> 'email')));

create policy "goal_steps: accepted partners read"
  on public.goal_steps for select to authenticated
  using (public.is_accepted_partner(goal_id));

-- Partners can see the owner's display name.
create policy "profiles: partners read owners"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.goal_partners gp
    where gp.owner_id = profiles.id and gp.partner_id = auth.uid() and gp.status = 'accepted'));

-- ---------- Nudges ----------

create policy "partner_nudges: members read"
  on public.partner_nudges for select to authenticated
  using (from_id = auth.uid() or to_id = auth.uid());

-- A nudge can only go between the two people on an accepted partnership.
create policy "partner_nudges: members send"
  on public.partner_nudges for insert to authenticated
  with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.goal_partners gp
      where gp.goal_id = partner_nudges.goal_id
        and gp.status = 'accepted'
        and (
          (gp.owner_id = partner_nudges.from_id and gp.partner_id = partner_nudges.to_id)
          or (gp.partner_id = partner_nudges.from_id and gp.owner_id = partner_nudges.to_id)
        )
    )
  );

create policy "partner_nudges: recipient marks seen"
  on public.partner_nudges for update to authenticated
  using (to_id = auth.uid())
  with check (to_id = auth.uid());
