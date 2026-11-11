# Production baseline

Read-only snapshot of Supabase project `manamarketingplatform` (`nwkmnjosszawzvtieied`) taken 2026-11-11.

`20261111154500_production.sql` records the live tables, indexes, policies, triggers, and functions. It is in this folder, not beside the other migration files, so the Supabase CLI will not try to apply it.

Do not run it against production. Those objects already exist. Production was not modified to create this snapshot.

The history table on production only lists eight versions, and their timestamps do not match the filenames in `supabase/migrations`. The schedule, Google allowlist, and access-rules objects are live, but they were not recorded there. The password guard in this snapshot is the live one: it allows Supabase Auth to clear a temporary password during Google sign-in, and it still refuses a stored password on a staff account.
