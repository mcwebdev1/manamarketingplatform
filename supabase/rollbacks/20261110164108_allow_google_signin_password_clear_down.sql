-- Rollback for migrations/20261110164108_allow_google_signin_password_clear.sql.
-- Restores the stricter password guard. Google sign-in for a new staff
-- account fails again, because Supabase Auth clears the temporary password
-- during that sign-in.

create or replace function private.guard_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_reserved_staff_email(old.email)
     or exists (
       select 1 from auth.identities i
       where i.user_id = new.id and i.provider = 'google'
     ) then
    raise exception 'Staff accounts sign in with Google only and cannot have a password';
  end if;

  return new;
end;
$$;
