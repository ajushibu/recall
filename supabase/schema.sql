-- Run this once in Supabase: SQL Editor -> New query -> paste -> Run.

create table if not exists public.notes (
  id          uuid primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null default '',
  body        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted     boolean not null default false,
  gen_hash    text,
  gen_at      timestamptz,
  server_ts   timestamptz not null default now()
);

create table if not exists public.cards (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id       uuid not null,
  type          text not null default 'recall',
  question      text not null,
  options       jsonb,
  answer        text not null,
  explanation   text,
  importance    int  not null default 3,
  due           date not null,
  interval_days int  not null default 0,
  ease          double precision not null default 2.5,
  reps          int  not null default 0,
  lapses        int  not null default 0,
  status        text not null default 'active',
  feedback      text,
  last_reviewed timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted       boolean not null default false,
  server_ts     timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  daily_cap  int  not null default 10,
  density    text not null default 'balanced',
  guidance   text not null default '',
  updated_at timestamptz not null default now(),
  server_ts  timestamptz not null default now()
);

-- server_ts is stamped by the database so sync never depends on device clocks
create or replace function public.set_server_ts() returns trigger
language plpgsql as $$
begin
  new.server_ts = now();
  return new;
end $$;

drop trigger if exists notes_ts on public.notes;
create trigger notes_ts before insert or update on public.notes
  for each row execute function public.set_server_ts();

drop trigger if exists cards_ts on public.cards;
create trigger cards_ts before insert or update on public.cards
  for each row execute function public.set_server_ts();

drop trigger if exists settings_ts on public.user_settings;
create trigger settings_ts before insert or update on public.user_settings
  for each row execute function public.set_server_ts();

create index if not exists notes_user_ts on public.notes (user_id, server_ts);
create index if not exists cards_user_ts on public.cards (user_id, server_ts);

-- Row level security: you only ever see your own rows
alter table public.notes         enable row level security;
alter table public.cards         enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own cards" on public.cards;
create policy "own cards" on public.cards
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own settings" on public.user_settings;
create policy "own settings" on public.user_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Folders (added with the Library). Safe to run more than once.
alter table public.notes add column if not exists folder_id text;
alter table public.user_settings add column if not exists folders jsonb not null default '[]'::jsonb;
alter table public.cards add column if not exists gaps jsonb;
