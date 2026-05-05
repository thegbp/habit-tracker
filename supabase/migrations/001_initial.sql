-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- User profiles (extends Supabase auth.users)
create table public.profiles (
  id                       uuid references auth.users(id) on delete cascade primary key,
  notification_time        time    not null default '21:00:00',
  notification_timezone    text    not null default 'UTC',
  notification_enabled     boolean not null default true,
  last_notification_sent   date,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- Habits
create table public.habits (
  id           uuid    default uuid_generate_v4() primary key,
  user_id      uuid    references auth.users(id) on delete cascade not null,
  name         text    not null,
  frequency    text    not null default 'daily'
                       check (frequency in ('daily', 'weekly', 'monthly')),
  schedulable  boolean not null default false,
  window_type  text    not null default 'any'
                       check (window_type in ('any', 'specific')),
  day_of_week  integer check (day_of_week >= 0 and day_of_week <= 6),
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Habit logs (one row per habit per date)
create table public.habit_logs (
  id             uuid    default uuid_generate_v4() primary key,
  habit_id       uuid    references public.habits(id) on delete cascade not null,
  user_id        uuid    references auth.users(id) on delete cascade not null,
  date           date    not null,
  completed      boolean not null default false,
  missed_reason  text,
  created_at     timestamptz not null default now(),
  unique (habit_id, date)
);

-- Push subscriptions
create table public.push_subscriptions (
  id         uuid    default uuid_generate_v4() primary key,
  user_id    uuid    references auth.users(id) on delete cascade not null,
  endpoint   text    not null,
  keys       jsonb   not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- Row-Level Security
alter table public.profiles          enable row level security;
alter table public.habits            enable row level security;
alter table public.habit_logs        enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "own profile"      on public.profiles          for all using (auth.uid() = id);
create policy "own habits"       on public.habits            for all using (auth.uid() = user_id);
create policy "own habit_logs"   on public.habit_logs        for all using (auth.uid() = user_id);
create policy "own push_subs"    on public.push_subscriptions for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index on public.habits        (user_id);
create index on public.habit_logs    (habit_id);
create index on public.habit_logs    (user_id, date);
create index on public.push_subscriptions (user_id);
