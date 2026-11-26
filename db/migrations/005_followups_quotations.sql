-- Follow-ups (scheduled calls / visits) and quotations (cost sheets) for the admin sales dashboard.
create table if not exists sales.followups (
  id bigserial primary key,
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  due_at timestamptz not null,
  kind text not null default 'Call' check (kind in ('Call','WhatsApp','Site visit','Meeting','Email')),
  note text not null default '',
  created_by int references sales.users(id),
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by int references sales.users(id),
  outcome text not null default ''
);
create index if not exists followups_open on sales.followups (due_at) where done_at is null;
create index if not exists followups_enq on sales.followups (enquiry_id);

create sequence if not exists sales.quotation_seq start 1001;
create table if not exists sales.quotations (
  id text primary key default ('Q-' || nextval('sales.quotation_seq')),
  enquiry_id text not null references sales.enquiries(id) on delete cascade,
  flat_id uuid references public.flats(id),
  unit_label text not null default '',
  data jsonb not null,
  total numeric(14,2) not null,
  valid_until date not null,
  created_by int references sales.users(id),
  created_at timestamptz not null default now()
);
create index if not exists quotations_enq on sales.quotations (enquiry_id);
create index if not exists quotations_created on sales.quotations (created_at desc);

grant all on sales.followups, sales.quotations to sales_portal;
grant all on sequence sales.followups_id_seq, sales.quotation_seq to sales_portal;

-- Supabase: keep RLS on, allow only the portal's role.
alter table sales.followups enable row level security;
alter table sales.quotations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='sales' and tablename='followups' and policyname='sales_portal_all') then
    create policy sales_portal_all on sales.followups for all to sales_portal using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='sales' and tablename='quotations' and policyname='sales_portal_all') then
    create policy sales_portal_all on sales.quotations for all to sales_portal using (true) with check (true);
  end if;
end $$;
