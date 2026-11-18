-- Voyago schema. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: everything is idempotent.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Last-write-wins guard: a stale offline write can never overwrite newer data.
-- ---------------------------------------------------------------------------
create or replace function public.voyago_lww() returns trigger
language plpgsql as $$
begin
  if old.updated_at > new.updated_at then
    return null; -- ignore stale write
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.voyago_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists voyago_on_signup on auth.users;
create trigger voyago_on_signup after insert on auth.users
  for each row execute function public.voyago_new_user();

-- ---------------------------------------------------------------------------
-- Core tables. Every row is owned by one user. deleted = soft delete so the
-- deletion also syncs to offline devices.
-- ---------------------------------------------------------------------------
create table if not exists public.trips (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  name text not null,
  destination text not null default '',
  start_date date not null,
  end_date date not null,
  travellers_count int not null default 1 check (travellers_count >= 1),
  traveller_type text not null default 'solo' check (traveller_type in ('solo','couple','family','group')),
  trip_type text not null default 'vacation' check (trip_type in ('vacation','business','wedding','adventure','medical','other')),
  travel_mode text not null default 'flight' check (travel_mode in ('flight','train','road','other')),
  accommodation text not null default '',
  notes text not null default '',
  cover_image text,
  weather jsonb,
  status text not null default 'planning' check (status in ('planning','packed','completed')),
  international boolean not null default false
);

create table if not exists public.travellers (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  kind text not null default 'adult' check (kind in ('adult','child','infant'))
);

create table if not exists public.packing_categories (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  name text not null,
  icon text not null default 'Package',
  sort_order int not null default 100
);

create table if not exists public.packing_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  category text not null,
  quantity int not null default 1 check (quantity >= 1),
  packed boolean not null default false,
  priority text not null default 'optional' check (priority in ('essential','optional')),
  notes text not null default '',
  bag text,
  sort_order int not null default 0,
  source text not null default 'manual' check (source in ('manual','template','generator','ai'))
);
-- one live row per item name per trip: prevents duplicates from races or retries
create unique index if not exists packing_items_unique_live
  on public.packing_items (trip_id, lower(name)) where not deleted;
create index if not exists packing_items_trip_idx on public.packing_items (trip_id);

create table if not exists public.packing_templates (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  name text not null,
  description text not null default '',
  trip_type text not null default 'vacation',
  nights int not null default 3
);

create table if not exists public.template_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  template_id uuid not null references public.packing_templates (id) on delete cascade,
  name text not null,
  category text not null,
  quantity int not null default 1 check (quantity >= 1),
  priority text not null default 'optional' check (priority in ('essential','optional')),
  notes text not null default '',
  bag text
);

-- Travel Memory: structured, editable, deletable preferences.
create table if not exists public.user_preferences (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  kind text not null check (kind in ('permanent','trip_type','frequent','avoid','context')),
  statement text not null,
  item_name text not null,
  category text,
  effect text not null check (effect in ('include','exclude','quantity','note')),
  quantity int,
  trip_types text[] not null default '{}',
  min_nights int,
  max_nights int,
  source text not null default 'manual' check (source in ('chat','manual')),
  active boolean not null default true
);

-- Snapshot of what was packed on a finished trip ("what did I pack last time in Goa?").
create table if not exists public.travel_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  destination text not null default '',
  trip_type text not null default 'vacation',
  nights int not null default 0,
  summary text not null default '',
  snapshot jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table if not exists public.chat_conversations (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid references public.trips (id) on delete set null,
  title text not null default 'New chat'
);

create table if not exists public.chat_messages (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null default '',
  actions jsonb
);
create index if not exists chat_messages_conv_idx on public.chat_messages (conversation_id, created_at);

-- Every change the AI makes, with before/after, so it can be undone.
create table if not exists public.ai_action_logs (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  action_type text not null,
  summary text not null default '',
  table_name text not null,
  entity_id uuid not null,
  before jsonb,
  after jsonb,
  undone boolean not null default false
);

-- ---------------------------------------------------------------------------
-- Future modules (schema only; the app shows them as "Coming soon").
-- ---------------------------------------------------------------------------
create table if not exists public.trip_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete cascade,
  kind text not null default 'other',
  title text not null,
  storage_path text,
  created_at timestamptz not null default now()
);
create table if not exists public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date not null,
  title text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_id uuid not null references public.itinerary_days (id) on delete cascade,
  start_time time,
  title text not null,
  location text,
  notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'other',
  title text not null,
  reference text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  category text not null default 'other',
  amount numeric(12,2) not null default 0,
  currency text not null default 'INR',
  note text,
  spent_on date,
  created_at timestamptz not null default now()
);
create table if not exists public.travel_journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  body text not null default '',
  place text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can only ever see and change their own rows.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'trips','travellers','packing_categories','packing_items','packing_templates','template_items',
    'user_preferences','travel_memories','chat_conversations','chat_messages','ai_action_logs',
    'trip_documents','itinerary_days','itinerary_activities','bookings','expenses','travel_journal_entries'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
  end loop;

  -- stale-write guard on every synced table
  foreach t in array array[
    'trips','travellers','packing_categories','packing_items','packing_templates','template_items',
    'user_preferences','chat_conversations','chat_messages','ai_action_logs'
  ] loop
    execute format('drop trigger if exists %I on public.%I', t || '_lww', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.voyago_lww()', t || '_lww', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- Realtime: lets the app update instantly when the AI (or another device) changes data.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'trips','travellers','packing_categories','packing_items','packing_templates','template_items',
    'user_preferences','chat_conversations','chat_messages','ai_action_logs'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Private storage for future document uploads (path must start with the user id).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('trip-documents', 'trip-documents', false)
  on conflict (id) do nothing;

drop policy if exists trip_documents_rw on storage.objects;
create policy trip_documents_rw on storage.objects for all to authenticated
  using (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'trip-documents' and (storage.foldername(name))[1] = auth.uid()::text);
