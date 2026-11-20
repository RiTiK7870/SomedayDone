-- SomedayDone: badges that stay earned. Apply after 002_features.sql.

create table if not exists public.user_badges (
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge_id  text not null check (char_length(badge_id) between 1 and 40),
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

alter table public.user_badges enable row level security;

create policy "user_badges: own rows"
  on public.user_badges for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
