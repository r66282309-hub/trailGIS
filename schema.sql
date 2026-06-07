-- TrailGIS Sardegna - Fase 1
-- Esegui questo script nel SQL Editor del progetto.
-- Include: registrazione utenti tramite Auth, percorsi pubblici, filtro "i miei percorsi".

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_public" on public.profiles;
create policy "profiles_select_public"
on public.profiles
for select
using (true);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.trails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  area text,
  description text,
  gpx_xml text not null,
  source_format text not null default 'gpx',
  geojson jsonb not null,
  distance_m numeric,
  elevation_gain numeric,
  centroid_lat numeric,
  centroid_lon numeric,
  created_at timestamptz not null default now()
);

alter table public.trails add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table public.trails add column if not exists source_format text not null default 'gpx';
alter table public.trails add column if not exists centroid_lat numeric;
alter table public.trails add column if not exists centroid_lon numeric;
alter table public.trails add column if not exists elevation_gain numeric;

alter table public.trails enable row level security;

drop policy if exists "trails_select_public" on public.trails;
create policy "trails_select_public"
on public.trails
for select
using (true);

drop policy if exists "trails_insert_public_prototype" on public.trails;
drop policy if exists "trails_insert_authenticated" on public.trails;
create policy "trails_insert_authenticated"
on public.trails
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "trails_update_own" on public.trails;
create policy "trails_update_own"
on public.trails
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "trails_delete_own" on public.trails;
create policy "trails_delete_own"
on public.trails
for delete
to authenticated
using (auth.uid() = user_id);
