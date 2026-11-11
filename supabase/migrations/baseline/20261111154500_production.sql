-- Production baseline for manamarketingplatform (nwkmnjosszawzvtieied).
-- Read-only snapshot taken 2026-11-11. Do not apply this file to that project.
-- The Supabase CLI ignores this folder. See README.md in this directory.
--
-- schema_migrations on production lists only:
--   20260921151620 init_onboarding_schema
--   20260921151801 lock_down_role_and_bootstrap_admin
--   20260921154949 module_links_and_intern_admin
--   20260921162036 managers_and_admin_accounts
--   20260921164422 master_role
--   20260921164539 intern_managers_and_invites
--   20260921165555 module_link_description
--   20261110164108 allow_google_signin_password_clear
-- Schedules, the staff allowlist, and the access rules are live anyway.

create schema if not exists private;

do $$ begin
  create type public.user_role as enum ('admin', 'intern', 'master');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.assignment_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.schedule_status as enum ('available', 'unavailable', 'remote', 'out');
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'intern',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_email_lower_idx on public.profiles (lower(email));
create index if not exists profiles_role_idx on public.profiles (role);

create table if not exists public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  platform text,
  content text not null default '',
  estimated_minutes integer,
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.module_links (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  title text not null,
  url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  description text
);

create index if not exists module_links_module_id_idx on public.module_links (module_id);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  status public.assignment_status not null default 'not_started',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, module_id)
);

create index if not exists assignments_intern_id_idx on public.assignments (intern_id);
create index if not exists assignments_module_id_idx on public.assignments (module_id);

create table if not exists public.intern_managers (
  intern_id uuid not null references public.profiles (id) on delete cascade,
  manager_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  primary key (intern_id, manager_id)
);

create index if not exists intern_managers_manager_id_idx on public.intern_managers (manager_id);

create table if not exists public.schedules (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  week_start date generated always as (day - (extract(isodow from day)::integer - 1)) stored,
  status public.schedule_status not null,
  start_time time,
  end_time time,
  expected_hours numeric(4,2) generated always as (
    case
      when start_time is null or end_time is null then 0::numeric
      else round((extract(epoch from (end_time - start_time)) / 3600)::numeric, 2)
    end
  ) stored,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intern_id, day),
  constraint schedules_weekday_only check (
    extract(isodow from day) >= 1 and extract(isodow from day) <= 5
  ),
  constraint schedules_time_range check (
    (
      status in ('available', 'remote')
      and start_time is not null
      and end_time is not null
      and end_time > start_time
    )
    or (
      status in ('unavailable', 'out')
      and start_time is null
      and end_time is null
    )
  )
);

create index if not exists schedules_week_start_idx on public.schedules (week_start);

create table if not exists public.time_logs (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.profiles (id) on delete cascade,
  clock_in timestamptz not null,
  clock_out timestamptz,
  work_date date generated always as ((clock_in at time zone private.app_timezone())::date) stored,
  actual_hours numeric(6,2) generated always as (
    case
      when clock_out is null then null
      else round((extract(epoch from (clock_out - clock_in)) / 3600)::numeric, 2)
    end
  ) stored,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint time_logs_clock_out_after_clock_in check (clock_out is null or clock_out > clock_in)
);

create unique index if not exists time_logs_one_open_session_idx
  on public.time_logs (intern_id) where clock_out is null;
create index if not exists time_logs_intern_work_date_idx on public.time_logs (intern_id, work_date);
create index if not exists time_logs_work_date_idx on public.time_logs (work_date);

create table if not exists private.staff_allowlist (
  email text primary key,
  role public.user_role not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid,
  constraint staff_allowlist_email_check check (email = lower(trim(email))),
  constraint staff_allowlist_role_check check (role in ('admin', 'master'))
);

alter table public.profiles enable row level security;
alter table public.modules enable row level security;
alter table public.module_links enable row level security;
alter table public.assignments enable row level security;
alter table public.intern_managers enable row level security;
alter table public.schedules enable row level security;
alter table public.time_logs enable row level security;
alter table private.staff_allowlist enable row level security;

-- private.staff_allowlist has row security and no policies. Only the table
-- owner and security-definer functions can read it.

-- Policies below match pg_policies on 2026-11-11. They are not re-created here
-- with DROP/CREATE, because this file must not be applied to production.
-- Names and rules:
--
-- profiles_select_own_or_admin
--   select: id = auth.uid() or private.is_admin()
-- profiles_update_own_or_managed
--   update: id = auth.uid() or private.is_master() or private.can_manage_intern(id)
-- modules_select_assigned_or_admin
--   select: private.is_admin() or an assignment exists for auth.uid()
-- modules_write_admin / modules_update_admin / modules_delete_admin
--   insert, update, delete: private.is_admin()
-- module_links_select_assigned_or_admin
--   select: private.is_admin() or an assignment exists for auth.uid() on that module
-- module_links_insert_admin / module_links_update_admin / module_links_delete_admin
--   insert, update, delete: private.is_admin()
-- assignments_select_own_or_admin
--   select: intern_id = auth.uid() or private.is_admin()
-- assignments_insert_managed
--   insert: private.can_manage_intern(intern_id)
-- assignments_update_own_or_managed
--   update: intern_id = auth.uid() or private.can_manage_intern(intern_id)
-- assignments_delete_managed
--   delete: private.can_manage_intern(intern_id)
-- intern_managers_select
--   select: intern_id = auth.uid() or private.is_admin()
-- intern_managers_insert
--   insert: created_by = auth.uid() and (private.is_master() or (private.is_admin() and manager_id = auth.uid()))
-- intern_managers_delete
--   delete: private.is_master() or (private.is_admin() and manager_id = auth.uid())
-- schedules_select_own_or_managed
--   select: (intern_id = auth.uid() and private.is_intern()) or private.can_manage_intern(intern_id)
-- schedules_insert_own_or_managed
--   insert: own future day inside the window, or private.can_manage_intern(intern_id)
-- schedules_update_own_or_managed
--   update: own day from today through the window, or private.can_manage_intern(intern_id)
-- schedules_delete_managed
--   delete: private.can_manage_intern(intern_id)
-- time_logs_select_own_or_managed
--   select: (intern_id = auth.uid() and private.is_intern()) or private.can_manage_intern(intern_id)
-- time_logs_insert_managed / time_logs_update_managed / time_logs_delete_managed
--   insert, update, delete: private.can_manage_intern(intern_id)
--   Interns clock through private.clock_in() and private.clock_out(), not these policies.

-- Live triggers
-- profiles_protect_role before update -> private.protect_profile_role()
-- profiles_role_changed after update of role when the role changes -> private.clean_links_after_role_change()
-- profiles_touch_updated_at before update -> private.touch_updated_at()
-- modules_touch_updated_at before update -> private.touch_updated_at()
-- assignments_protect_progress before update -> private.protect_assignment_progress()
-- assignments_touch_updated_at before update -> private.touch_updated_at()
-- intern_managers_validate before insert or update -> private.validate_intern_manager_row()
-- schedules_stamp before insert or update -> private.stamp_intern_row()
-- time_logs_stamp before insert or update -> private.stamp_intern_row()
-- time_logs_validate before insert or update -> private.validate_time_log()
-- auth.users on_auth_user_created after insert -> private.handle_new_user()
-- auth.users on_auth_user_email_change before update of email, email_change -> private.guard_auth_email_change()
-- auth.users on_auth_user_password_change before update of encrypted_password
--   when the password value changes -> private.guard_auth_password_change()
-- auth.identities on_auth_identity_saved before insert or update -> private.guard_google_identity()

-- Live function list. Bodies are the definitions returned by pg_get_functiondef
-- on 2026-11-11. private.* holds the rules. public.* is the RPC surface.

-- The password guard below is the live body, including the empty-password
-- exemption that production already has. The committed migration files do not.

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

-- Other live functions, by name. Their current bodies are in the migration
-- files listed, except where this snapshot says otherwise.
--
-- private.app_timezone()
-- private.local_today()
-- private.schedule_window_end()  -- Monday of this week plus 60 days
-- private.random_pin()
-- private.normalize_login_email(text)
-- private.is_admin()             -- role in (admin, master)
-- private.is_master()
-- private.is_intern()
-- private.is_google_master()
-- private.is_reserved_staff_email(text)
-- private.google_staff_role(text, text, boolean)
-- private.google_access_facts()
-- private.can_manage_intern(uuid) -- target must be an intern, and the caller is master or a linked manager
-- private.handle_new_user()
-- private.guard_google_identity()
-- private.guard_auth_email_change()
-- private.create_invited_user(text, text, text, user_role)
-- private.create_login_user(text, text, text, user_role)
-- private.create_intern(text, text, uuid[])
-- private.create_manager(text, text)
-- private.delete_intern(uuid)
-- private.delete_manager(uuid)   -- refuses admin, admin1, admin2, admin3 @mana.internal
-- private.my_managers()
-- private.protect_profile_role()
-- private.protect_assignment_progress()
-- private.clean_links_after_role_change()
-- private.validate_intern_manager_row()
-- private.validate_time_log()
-- private.stamp_intern_row()
-- private.touch_updated_at()
-- private.clock_in()
-- private.clock_out()
-- public.clock_in(), public.clock_out(), public.create_intern(text, text, uuid[] default '{}'),
-- public.create_manager(text, text), public.delete_intern(uuid), public.delete_manager(uuid),
-- public.google_access_facts(), public.my_managers()
--   These public functions call the private function of the same name.
