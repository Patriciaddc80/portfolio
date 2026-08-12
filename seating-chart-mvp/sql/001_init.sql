-- ============================================================
-- Seating Chart MVP — Supabase / PostgreSQL schema
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- events
-- ---------------------------------------------------------------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  date        date,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_events_user_id on public.events (user_id);

-- ---------------------------------------------------------------
-- tables (the physical tables on the floor plan)
-- ---------------------------------------------------------------
create type public.table_type as enum ('round', 'rectangular');

create table if not exists public.tables (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  type           public.table_type not null default 'round',
  label          text,                     -- e.g. "Mesa 1"
  target_chairs  smallint not null default 8 check (target_chairs > 0 and target_chairs <= 40),
  x              double precision not null default 0,
  y              double precision not null default 0,
  rotation       double precision not null default 0,   -- degrees
  scale          double precision not null default 1,
  width          double precision default 160,           -- rectangular only
  height         double precision default 80,             -- rectangular only
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Fast lookup: "give me all tables for this event" (drives the canvas render)
create index if not exists idx_tables_event_id on public.tables (event_id);

-- ---------------------------------------------------------------
-- guests
-- ---------------------------------------------------------------
create type public.diet_status as enum ('none', 'vegan', 'vegetarian', 'gluten_free', 'other');

create table if not exists public.guests (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events(id) on delete cascade,
  name         text not null,
  table_id     uuid references public.tables(id) on delete set null,
  seat_number  smallint,                    -- position around the table (0-indexed)
  status_diet  public.diet_status not null default 'none',
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- a seat can only be occupied by one guest at a time
  constraint uq_guest_seat unique (table_id, seat_number)
);

-- Fast lookup: all guests for an event (sidebar list)
create index if not exists idx_guests_event_id on public.guests (event_id);
-- Fast lookup: guests already seated at a given table (canvas rendering)
create index if not exists idx_guests_table_id on public.guests (table_id) where table_id is not null;
-- Fast lookup: unseated guests for the sidebar ("WHERE table_id IS NULL")
create index if not exists idx_guests_unassigned on public.guests (event_id) where table_id is null;

-- ---------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger trg_tables_updated_at before update on public.tables
  for each row execute function public.set_updated_at();
create trigger trg_guests_updated_at before update on public.guests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security — each user only sees their own events data
-- ---------------------------------------------------------------
alter table public.events enable row level security;
alter table public.tables enable row level security;
alter table public.guests enable row level security;

create policy "events_owner_all" on public.events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tables_owner_all" on public.tables
  for all using (exists (
    select 1 from public.events e where e.id = tables.event_id and e.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.events e where e.id = tables.event_id and e.user_id = auth.uid()
  ));

create policy "guests_owner_all" on public.guests
  for all using (exists (
    select 1 from public.events e where e.id = guests.event_id and e.user_id = auth.uid()
  )) with check (exists (
    select 1 from public.events e where e.id = guests.event_id and e.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------
-- Realtime: broadcast changes on tables/guests to subscribed clients
-- ---------------------------------------------------------------
alter publication supabase_realtime add table public.tables;
alter publication supabase_realtime add table public.guests;
