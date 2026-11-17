-- SomedayDone initial schema: tables, indexes, RLS, and profile creation.
-- Apply with: supabase db push  (or paste into the SQL editor).

-- ---------- Tables ----------

create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(btrim(title)) between 1 and 120),
  description text check (description is null or char_length(description) <= 1000),
  category    text not null check (category in
                ('Personal Growth','Travel','Fitness','Career','Learning','Experiences','Other')),
  target_date date,
  status      text not null default 'not_started' check (status in
                ('not_started','in_progress','completed','archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  completed_at timestamptz
);
create index goals_user_status_updated_idx on public.goals (user_id, status, updated_at desc);

create table public.goal_steps (
  id           uuid primary key default gen_random_uuid(),
  goal_id      uuid not null references public.goals(id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  is_completed boolean not null default false,
  position     integer not null default 0 check (position >= 0),
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index goal_steps_goal_position_idx on public.goal_steps (goal_id, position);

create table public.reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  goal_id          uuid not null unique references public.goals(id) on delete cascade,
  reminder_time    timestamptz not null,
  frequency        text not null check (frequency in ('once','daily')),
  timezone         text not null,
  is_enabled       boolean not null default true,
  notification_id  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ---------- updated_at maintenance ----------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger goals_updated_at before update on public.goals
  for each row execute function public.set_updated_at();
create trigger goal_steps_updated_at before update on public.goal_steps
  for each row execute function public.set_updated_at();
create trigger reminders_updated_at before update on public.reminders
  for each row execute function public.set_updated_at();

-- ---------- Idempotent profile creation on first sign-in ----------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------
-- "for all" applies to select, insert, update, and delete.
-- "with check" stops a user from writing rows they do not own.

alter table public.profiles   enable row level security;
alter table public.goals      enable row level security;
alter table public.goal_steps enable row level security;
alter table public.reminders  enable row level security;

create policy "profiles: own row"
  on public.profiles for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "goals: own rows"
  on public.goals for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "goal_steps: only via own goal"
  on public.goal_steps for all to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_steps.goal_id and g.user_id = auth.uid()))
  with check (exists (
    select 1 from public.goals g
    where g.id = goal_steps.goal_id and g.user_id = auth.uid()));

create policy "reminders: own rows via own goal"
  on public.reminders for all to authenticated
  using (user_id = auth.uid() and exists (
    select 1 from public.goals g
    where g.id = reminders.goal_id and g.user_id = auth.uid()))
  with check (user_id = auth.uid() and exists (
    select 1 from public.goals g
    where g.id = reminders.goal_id and g.user_id = auth.uid()));
