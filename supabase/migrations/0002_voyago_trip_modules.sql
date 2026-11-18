-- Voyago 0002: real trip modules (documents, itinerary + hidden gems, bookings, expenses, journal)
-- The placeholder tables from 0001 were never used, so they are replaced with synced versions.

drop table if exists public.itinerary_activities cascade;
drop table if exists public.itinerary_days cascade;
drop table if exists public.trip_documents cascade;
drop table if exists public.bookings cascade;
drop table if exists public.expenses cascade;
drop table if exists public.travel_journal_entries cascade;

alter table public.trips add column if not exists budget numeric(12,2);

create table public.trip_documents (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'other',
  title text not null,
  notes text not null default '',
  file_name text,
  mime text,
  size_bytes int,
  storage_path text
);

create table public.itinerary_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'plan' check (kind in ('plan','gem')),
  day_date date,
  start_time text,
  title text not null,
  location text not null default '',
  notes text not null default '',
  tag text not null default '',
  done boolean not null default false,
  sort_order int not null default 0
);

create table public.bookings (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  kind text not null default 'other',
  title text not null,
  provider text not null default '',
  reference text not null default '',
  start_date date,
  end_date date,
  amount numeric(12,2),
  status text not null default 'confirmed' check (status in ('confirmed','pending','cancelled')),
  notes text not null default ''
);

create table public.expenses (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  category text not null default 'other',
  amount numeric(12,2) not null default 0 check (amount >= 0),
  note text not null default '',
  spent_on date,
  paid_by text not null default ''
);

create table public.journal_entries (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  trip_id uuid not null references public.trips (id) on delete cascade,
  entry_date date,
  place text not null default '',
  body text not null default '',
  photo text
);

create index trip_documents_trip_idx on public.trip_documents (trip_id);
create index itinerary_items_trip_idx on public.itinerary_items (trip_id);
create index bookings_trip_idx on public.bookings (trip_id);
create index expenses_trip_idx on public.expenses (trip_id);
create index journal_entries_trip_idx on public.journal_entries (trip_id);

do $$
declare t text;
begin
  foreach t in array array['trip_documents','itinerary_items','bookings','expenses','journal_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format('create policy %I on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_own', t);
    execute format('drop trigger if exists %I on public.%I', t || '_lww', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.voyago_lww()', t || '_lww', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
