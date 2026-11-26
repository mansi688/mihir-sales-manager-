-- Full Booking Application Form (applicants, addresses, flat, CLP, bank, loan, sales & CP, declaration).
-- The application itself is stored as JSON in sales.bookings.extra (see src/content/booking-form.js).

alter table sales.users add column if not exists employee_id text not null default '';

alter table sales.channel_partners add column if not exists reg_code text not null default '';
alter table sales.channel_partners add column if not exists rep_name text not null default '';
alter table sales.channel_partners add column if not exists phone text not null default '';
alter table sales.channel_partners add column if not exists email text not null default '';

alter table sales.bookings add column if not exists other_charges numeric(14,2);
alter table sales.bookings add column if not exists total_consideration numeric(14,2);

alter table sales.payments add column if not exists txn_date date;
alter table sales.payments add column if not exists bank_name text not null default '';
alter table sales.payments add column if not exists branch text not null default '';

-- First applicant, second applicant (co-applicant) and developer / authorised representative
alter table sales.signatures drop constraint if exists signatures_party_check;
alter table sales.signatures add constraint signatures_party_check
  check (party in ('customer','co_applicant','sales','manager','developer'));

update sales.users set employee_id = v.emp from (values
  ('919000000003','MG-SM-001'), ('919822011223','MG-SE-101'), ('919890144556','MG-SE-102'),
  ('919765477889','MG-SE-103'), ('919970022334','MG-SE-104')) v(phone, emp)
where sales.users.phone = v.phone and sales.users.employee_id = '';
