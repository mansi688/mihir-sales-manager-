-- Mihir Sales Portal — lives in its own `sales` schema inside the Mihir CRM Supabase project.
-- Reads the CRM's public.projects / towers / wings / flats (real inventory) and writes walk-ins
-- into public.enquiries. It never alters the CRM's own tables.

create schema if not exists sales;

create sequence if not exists sales.enquiry_seq start 1001;

create table if not exists sales.files (
  id uuid primary key default gen_random_uuid(),
  kind text not null,                       -- photo | kyc | signature | booking_pdf
  mime text not null,
  name text not null default '',
  data bytea not null,
  created_at timestamptz not null default now()
);

create table if not exists sales.users (
  id serial primary key,
  name text not null,
  designation text not null default '',
  phone text not null unique,               -- 91XXXXXXXXXX, login id
  email text not null default '',
  role text not null check (role in ('sales','reception','manager','accounts','admin')),
  pin_hash text not null,
  photo_file_id uuid references sales.files(id) on delete set null,
  status text not null default 'Available' check (status in ('Available','With customer','On site visit','Off')),
  slug text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists sales.user_projects (
  user_id int not null references sales.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  primary key (user_id, project_id)
);

create table if not exists sales.channel_partners (
  id serial primary key,
  name text not null,
  owner_user_id int references sales.users(id) on delete set null
);
create unique index if not exists channel_partners_name_ci on sales.channel_partners (lower(name));

create table if not exists sales.enquiries (
  id text primary key default ('MG-' || nextval('sales.enquiry_seq')),
  created_at timestamptz not null default now(),
  name text not null,
  mobile text not null,
  email text not null default '',
  residence text not null default '',
  project_id uuid not null references public.projects(id),
  config text not null,
  budget text not null,
  purpose text not null default '',
  source text not null,
  cp_name text not null default '',
  visit_pref text not null default '',
  consent boolean not null default false,
  stage text not null default 'Walk-in',
  assigned_to int references sales.users(id),
  assign_reason text not null default '',
  crm_enquiry_id uuid,                      -- row in public.enquiries
  wa_linked_at timestamptz,
  updated_at timestamptz not null default now()
);
create index if not exists enquiries_mobile on sales.enquiries (mobile);
create index if not exists enquiries_assigned on sales.enquiries (assigned_to);
create index if not exists enquiries_created on sales.enquiries (created_at desc);

create table if not exists sales.activities (
  id bigserial primary key,
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  at timestamptz not null default now(),
  user_id int references sales.users(id),
  type text not null,
  note text not null default ''
);
create index if not exists activities_enq on sales.activities (enquiry_id);

-- Hold / sold status per CRM flat (the CRM's flats table has no sales status of its own)
create table if not exists sales.unit_status (
  flat_id uuid primary key references public.flats(id) on delete cascade,
  status text not null check (status in ('On hold','Sold')),
  enquiry_id text references sales.enquiries(id) on delete set null,
  hold_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists sales.bookings (
  enquiry_id text primary key references sales.enquiries(id) on delete cascade,
  flat_id uuid not null references public.flats(id),
  tower text not null, wing text not null default '', floor text not null default '', unit text not null,
  carpet_area text not null default '', agreement_value numeric(14,2),
  payment_plan text not null default '', co_applicant text not null default '',
  extra jsonb not null default '{}'::jsonb,
  hold_until timestamptz,
  pdf_file_id uuid references sales.files(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sales.kyc_docs (
  id bigserial primary key,
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  kind text not null,
  file_id uuid not null references sales.files(id) on delete cascade,
  original_name text not null default '',
  uploaded_by int references sales.users(id),
  uploaded_at timestamptz not null default now()
);

create table if not exists sales.payments (
  id bigserial primary key,
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  amount numeric(14,2) not null,
  mode text not null, ref text not null default '',
  status text not null default 'Pending verification' check (status in ('Pending verification','Received','Rejected')),
  receipt_no text, remarks text not null default '',
  submitted_by int references sales.users(id), submitted_at timestamptz not null default now(),
  verified_by int references sales.users(id), verified_at timestamptz
);

create table if not exists sales.signatures (
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  party text not null check (party in ('customer','sales','manager')),
  file_id uuid references sales.files(id) on delete set null,
  signed_by int references sales.users(id),
  signed_at timestamptz not null default now(),
  primary key (enquiry_id, party)
);

create table if not exists sales.sync_log (
  id bigserial primary key,
  enquiry_id text, at timestamptz not null default now(),
  target text not null, action text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null, response text not null default ''
);

create table if not exists sales.wa_messages (
  id bigserial primary key,
  at timestamptz not null default now(),
  direction text not null, to_from text not null, enquiry_id text,
  kind text not null, body text not null, status text not null, response text not null default ''
);

-- The schema is not exposed through the Supabase REST API; lock it down anyway.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on schema sales from anon, authenticated; end if;
end $$;
