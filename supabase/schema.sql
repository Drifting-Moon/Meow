create type public.platform_name as enum ('leetcode', 'codeforces', 'gfg');

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#00ff87',
  created_at timestamptz not null default now()
);

create table if not exists public.platform_usernames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform public.platform_name not null,
  username text not null,
  auto_sync_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create table if not exists public.manual_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('leetcode', 'codeforces', 'gfg', 'other')),
  log_date date not null,
  count int not null default 0 check (count >= 0),
  difficulty_easy int not null default 0 check (difficulty_easy >= 0),
  difficulty_medium int not null default 0 check (difficulty_medium >= 0),
  difficulty_hard int not null default 0 check (difficulty_hard >= 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  daily_target int not null default 2 check (daily_target >= 0),
  long_term_target int not null default 300 check (long_term_target >= 0),
  long_term_deadline date,
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.cached_stats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null check (platform in ('leetcode', 'codeforces', 'gfg')),
  data jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null default now(),
  unique (user_id, platform)
);

alter table public.users enable row level security;
alter table public.platform_usernames enable row level security;
alter table public.manual_logs enable row level security;
alter table public.goals enable row level security;
alter table public.cached_stats enable row level security;

create policy "authenticated can read users" on public.users for select to authenticated using (true);
create policy "users insert self" on public.users for insert to authenticated with check (auth.uid() = id);
create policy "users update self" on public.users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "authenticated can read platform usernames" on public.platform_usernames for select to authenticated using (true);
create policy "platform usernames insert self" on public.platform_usernames for insert to authenticated with check (auth.uid() = user_id);
create policy "platform usernames update self" on public.platform_usernames for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "platform usernames delete self" on public.platform_usernames for delete to authenticated using (auth.uid() = user_id);

create policy "authenticated can read manual logs" on public.manual_logs for select to authenticated using (true);
create policy "manual logs insert self" on public.manual_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "manual logs update self" on public.manual_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manual logs delete self" on public.manual_logs for delete to authenticated using (auth.uid() = user_id);

create policy "authenticated can read goals" on public.goals for select to authenticated using (true);
create policy "goals insert self" on public.goals for insert to authenticated with check (auth.uid() = user_id);
create policy "goals update self" on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "authenticated can read cached stats" on public.cached_stats for select to authenticated using (true);
create policy "authenticated can insert cached stats" on public.cached_stats for insert to authenticated with check (true);
create policy "authenticated can update cached stats" on public.cached_stats for update to authenticated using (true) with check (true);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists platform_usernames_touch_updated_at on public.platform_usernames;
create trigger platform_usernames_touch_updated_at
before update on public.platform_usernames
for each row execute function public.touch_updated_at();

drop trigger if exists goals_touch_updated_at on public.goals;
create trigger goals_touch_updated_at
before update on public.goals
for each row execute function public.touch_updated_at();
