-- Sign in with a simple username (or mobile) and a password (or a 4–6 digit PIN).
alter table sales.users add column if not exists username text;
update sales.users set username = lower(split_part(name, ' ', 1)) where username is null;
-- de-duplicate any clashes by appending the id
update sales.users u set username = u.username || u.id
  where exists (select 1 from sales.users x where x.username = u.username and x.id < u.id);
create unique index if not exists users_username on sales.users (lower(username));
