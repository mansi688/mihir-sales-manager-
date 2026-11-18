-- Minimal stand-in for the Mihir CRM's public tables, used only by `npm test` on a local Postgres.
create extension if not exists pgcrypto;
create table if not exists public.projects (id uuid primary key default gen_random_uuid(), name text not null, code text not null, project_type text not null default 'residential', is_active boolean not null default true, landing_order int not null default 0);
create table if not exists public.towers (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id), name text not null, sort_order int not null default 0);
create table if not exists public.wings (id uuid primary key default gen_random_uuid(), tower_id uuid not null references public.towers(id), name text not null, sort_order int not null default 0);
create table if not exists public.flats (id uuid primary key default gen_random_uuid(), wing_id uuid not null references public.wings(id), flat_no text not null, floor int, flat_type text, carpet_area numeric);
create table if not exists public.enquiries (
  id uuid primary key default gen_random_uuid(), name text not null, phone text not null check (phone ~ '^[0-9+ ()-]{8,20}$'),
  email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'), project_id uuid references public.projects(id),
  message text, page text, status text not null default 'new' check (status in ('new','contacted','closed')), notes text,
  handled_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
alter table public.projects enable row level security;
alter table public.towers enable row level security;
alter table public.wings enable row level security;
alter table public.flats enable row level security;
alter table public.enquiries enable row level security;

do $$ declare p uuid; t uuid; w uuid; code text; nm text; begin
  if exists (select 1 from public.projects) then return; end if;
  for code, nm in select * from (values ('AMR','Mihir Amara'),('EQX','Nyati Equinox'),('SRA','Sierra'),('WBB','Wakad Business Bay')) v loop
    insert into public.projects(name, code) values (nm, code) returning id into p;
    insert into public.towers(project_id, name) values (p, 'Tower A') returning id into t;
    insert into public.wings(tower_id, name) values (t, 'A') returning id into w;
    for f in 1..3 loop for u in 1..4 loop
      insert into public.flats(wing_id, flat_no, floor, flat_type, carpet_area)
      values (w, 'A-' || f || lpad(u::text, 2, '0'), f, case when code = 'WBB' then (case when u % 2 = 0 then 'Shop' else 'Office' end) when u % 2 = 0 then '3 BHK' else '2 BHK' end, 700 + u * 120);
    end loop; end loop;
  end loop;
end $$;
