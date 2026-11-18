-- Demo staff. Every PIN is 1234 — change them from the Team page before real use.
insert into sales.users (name, designation, phone, email, role, pin_hash, slug) values
 ('Admin',          'System Admin',           '919000000001', 'admin@mihirgroup.com',     'admin',     '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'admin'),
 ('Kavita More',    'Front Office Executive', '919000000002', 'reception@mihirgroup.com', 'reception', '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'kavita-more'),
 ('Rajesh Nair',    'Sales Head',             '919000000003', 'rajesh.n@mihirgroup.com',  'manager',   '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'rajesh-nair'),
 ('Neha Gupta',     'Accounts Executive',     '919000000004', 'accounts@mihirgroup.com',  'accounts',  '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'neha-gupta'),
 ('Ankit Deshmukh', 'Senior Sales Manager',   '919822011223', 'ankit.d@mihirgroup.com',   'sales',     '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'ankit-deshmukh'),
 ('Priya Kulkarni', 'Sales Executive',        '919890144556', 'priya.k@mihirgroup.com',   'sales',     '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'priya-kulkarni'),
 ('Rohan Patil',    'Relationship Manager',   '919765477889', 'rohan.p@mihirgroup.com',   'sales',     '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'rohan-patil'),
 ('Sneha Joshi',    'Sales Executive',        '919970022334', 'sneha.j@mihirgroup.com',   'sales',     '$2b$10$kPjHrQ0UQnqkznrdUH.CFefbrrQEdE5ob7CSLD7H0vYpzb89NmoNa', 'sneha-joshi')
on conflict (phone) do nothing;

-- Project assignments by CRM project code
insert into sales.user_projects (user_id, project_id)
select u.id, p.id from (values
  ('919822011223','AMR'), ('919822011223','EQX'),
  ('919890144556','AMR'),
  ('919765477889','SRA'), ('919765477889','WBB'),
  ('919970022334','WBB'), ('919970022334','EQX'), ('919970022334','SRA'),
  ('919000000003','AMR'), ('919000000003','EQX'), ('919000000003','SRA'), ('919000000003','WBB')
) v(phone, code)
join sales.users u on u.phone = v.phone
join public.projects p on p.code = v.code
on conflict do nothing;

insert into sales.channel_partners (name, owner_user_id)
select 'Prime Realty', id from sales.users where phone = '919822011223'
on conflict do nothing;
