create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_color text not null default '#00ff87',
  created_at timestamptz not null default now()
);

create table if not exists public.manual_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  platform text not null default 'other',
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

create table if not exists public.shared_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  daily_target int not null default 1 check (daily_target >= 0),
  long_term_target int not null default 100 check (long_term_target >= 0),
  deadline date,
  color text not null default '#38bdf8',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.manual_logs enable row level security;
alter table public.goals enable row level security;
alter table public.shared_goals enable row level security;

drop policy if exists "authenticated can read users" on public.users;
drop policy if exists "users insert self" on public.users;
drop policy if exists "users update self" on public.users;
create policy "authenticated can read users" on public.users for select to authenticated using (true);
create policy "users insert self" on public.users for insert to authenticated with check (auth.uid() = id);
create policy "users update self" on public.users for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "authenticated can read manual logs" on public.manual_logs;
drop policy if exists "manual logs insert self" on public.manual_logs;
drop policy if exists "manual logs update self" on public.manual_logs;
drop policy if exists "manual logs delete self" on public.manual_logs;
create policy "authenticated can read manual logs" on public.manual_logs for select to authenticated using (true);
create policy "manual logs insert self" on public.manual_logs for insert to authenticated with check (auth.uid() = user_id);
create policy "manual logs update self" on public.manual_logs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "manual logs delete self" on public.manual_logs for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "authenticated can read goals" on public.goals;
drop policy if exists "goals insert self" on public.goals;
drop policy if exists "goals update self" on public.goals;
create policy "authenticated can read goals" on public.goals for select to authenticated using (true);
create policy "goals insert self" on public.goals for insert to authenticated with check (auth.uid() = user_id);
create policy "goals update self" on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "authenticated can read shared goals" on public.shared_goals;
drop policy if exists "authenticated can insert shared goals" on public.shared_goals;
drop policy if exists "authenticated can update shared goals" on public.shared_goals;
drop policy if exists "shared goal creators can delete" on public.shared_goals;
create policy "authenticated can read shared goals" on public.shared_goals for select to authenticated using (true);
create policy "authenticated can insert shared goals" on public.shared_goals for insert to authenticated with check (auth.uid() = created_by);
create policy "authenticated can update shared goals" on public.shared_goals for update to authenticated using (true) with check (true);
create policy "shared goal creators can delete" on public.shared_goals for delete to authenticated using (auth.uid() = created_by);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists goals_touch_updated_at on public.goals;
create trigger goals_touch_updated_at
before update on public.goals
for each row execute function public.touch_updated_at();

drop trigger if exists shared_goals_touch_updated_at on public.shared_goals;
create trigger shared_goals_touch_updated_at
before update on public.shared_goals
for each row execute function public.touch_updated_at();

-- login_shortcuts table for syncing friend login cards
create table if not exists public.login_shortcuts (
  id int primary key,
  name text not null,
  email text not null,
  password text not null,
  color text not null
);

alter table public.login_shortcuts enable row level security;

drop policy if exists "anyone can read login shortcuts" on public.login_shortcuts;
create policy "anyone can read login shortcuts" on public.login_shortcuts
  for select to anon, authenticated using (true);

drop policy if exists "anyone can update login shortcuts" on public.login_shortcuts;
create policy "anyone can update login shortcuts" on public.login_shortcuts
  for update to anon, authenticated using (true) with check (true);

insert into public.login_shortcuts (id, name, email, password, color) values
  (0, 'Jayant', 'jayant@gmail.com', 'Jayant', '#00ff87'),
  (1, 'krish', 'krish@gmail.com', 'krish', '#38bdf8'),
  (2, 'Arshita', 'arshita@gmail.com', 'Arshita', '#a78bfa')
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  password = excluded.password,
  color = excluded.color;

