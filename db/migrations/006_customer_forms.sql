-- Booking application details filled by the customer on their own phone (secure link sent by the sales person).
create table if not exists sales.customer_forms (
  enquiry_id text primary key references sales.enquiries(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  updated_at timestamptz not null default now()
);
grant all on sales.customer_forms to sales_portal;
alter table sales.customer_forms enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='sales' and tablename='customer_forms' and policyname='sales_portal_all') then
    create policy sales_portal_all on sales.customer_forms for all to sales_portal using (true) with check (true);
  end if;
end $$;
