-- Supabase Auth creates a Google account with a temporary password, then
-- clears encrypted_password before the email is confirmed. The previous
-- guard treated that clear as setting a password, so the first Google
-- sign-in failed with "Error updating user". A stored password hash is
-- still refused.

create or replace function private.guard_auth_password_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(new.encrypted_password, '') = '' then
    return new;
  end if;

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
