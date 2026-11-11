-- Local and preview data only.
-- `supabase db reset` runs this after the migrations.
-- Do not run it against production, and do not use `supabase db push --include-seed`
-- on manamarketingplatform.
--
-- Password equals the login. admin is master. admin1 manages intern1, and so on.

select private.create_login_user('admin', 'admin', 'Admin', 'master');
select private.create_login_user('admin1', 'admin1', 'Admin 1', 'admin');
select private.create_login_user('admin2', 'admin2', 'Admin 2', 'admin');
select private.create_login_user('admin3', 'admin3', 'Admin 3', 'admin');
select private.create_login_user('intern1', 'intern1', 'Intern 1', 'intern');
select private.create_login_user('intern2', 'intern2', 'Intern 2', 'intern');
select private.create_login_user('intern3', 'intern3', 'Intern 3', 'intern');

insert into public.intern_managers (intern_id, manager_id)
select intern.id, manager.id
from (
  values
    ('intern1@mana.internal', 'admin1@mana.internal'),
    ('intern2@mana.internal', 'admin2@mana.internal'),
    ('intern3@mana.internal', 'admin3@mana.internal')
) as pair(intern_email, manager_email)
join public.profiles intern on intern.email = pair.intern_email
join public.profiles manager on manager.email = pair.manager_email
on conflict do nothing;
