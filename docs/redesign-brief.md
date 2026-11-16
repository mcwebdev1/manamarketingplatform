# Mana Marketing Hub: redesign brief for Cursor

Repo: `mcwebdev1/manamarketingplatform` · Live: https://marketing.mana1.co · Reviewed 2026-11-11

Paste this file into a Cursor chat (or commit it as `docs/redesign-brief.md`) and work through the phases in order. Each phase is shippable on its own.

## How this was reviewed

- Walked the live staff side as the demo manager `admin1`, at tablet width (about 700px) and phone width (375px): Overview, Interns, an intern's page, the invite form, Modules, the new-module form, Schedule, the edit-sessions dialog.
- Master-only screens come from the owner's desktop screenshots.
- The intern side (`/onboarding`, `/schedule`) was **not** seen live. A staff login is redirected away from both. Intern-side items below come from the product description and are marked "verify".
- Nothing was saved, assigned or deleted during the review.

## What the product becomes

Not an onboarding tool. It is the marketing team's hub with two jobs:

1. **Learning**: anyone on the team can be sent modules and tracked, interns and employees alike.
2. **Time**: interns plan their week and clock in. Employees do not.

Working name: **Mana Marketing Hub** (replace "Mana Onboarding" in the header, sign-in page and tab titles; the tab currently reads "Admin · Mana Onboarding").

## Decisions taken in this brief (change any before starting)

| # | Decision | Default taken here |
| --- | --- | --- |
| 1 | How employees get learning | Every account, staff included, gets a "My learning" page. No new role. |
| 2 | Who can send modules to a manager | Any manager or master can send to any manager. Interns still only from their own managers. |
| 3 | Who has a schedule and time clock | Interns only. Controlled by one flag on the profile (`tracks_time`), on for interns, off for staff. |
| 4 | Manager claiming an intern | Keep it, but move it off the list row into the person page with a confirm. |
| 5 | What "on track" means | Modules: nothing past its due date. Time (interns): this week's plan filled in, and no open or over-12-hour session. |
| 6 | Demo accounts | Remove from production before real users start; keep in a seed script for local and preview. |
| 7 | Other departments | Out of scope now. Do not add a department field yet. |

## Problems found, most costly first

1. **Three places do one job.** Modules can be sent from the Assign tab, from the intern's page, and from the Overview button. The intern's page already does it best (checkboxes with status beside each module). The Assign tab is redundant.
2. **"Assign" means two different things.** "Assign to me" makes you the intern's manager. "Assign modules" sends learning. They sit next to each other on the Interns list.
3. **Schedule shows the same people twice.** "Team availability" and "Week report" are two tables with identical rows and columns. A manager has to read across both to compare plan and hours.
4. **Setting a week is slow.** The edit dialog needs a status and two times for each of five days, one at a time. There is no "same for all days", no "copy last week", and no default hours.
5. **Staff cannot be learners.** `/onboarding` and `/schedule` redirect a staff login to `/admin`. The new scope needs this.
6. **The home screen answers nothing.** Three count cards (4 interns, 4 modules, 20%) and a table of counts. It does not say who is behind or who is working today. On a phone the three cards fill the whole first screen.
7. **Phone layout breaks at the edges.** The nav row cuts off at "Sch…", the signed-in name disappears, and both schedule tables need sideways scrolling to see past Monday.
8. **Inviting stops halfway.** The invite form takes email and name only. Sending modules is a separate trip, and the PIN is shown once with no way to see or reset it later.
9. **No due dates.** Without one, "Assigned" for three weeks looks the same as "Assigned" today.
10. **Instructions stand in for design.** Every page opens with a paragraph explaining what to do ("Assign them to yourself from Interns if you own their track…"). Once the flow is obvious these can go.
11. **Destructive buttons are unlabeled and close to routine ones.** A red trash icon sits beside "Assign to me" on each row; removing an intern deletes the account. Verify there is a confirm, and move it off the row either way.
12. **Small things.** Module links show raw URLs. Two links in General Onboarding both point to `https://www.mana.com`. Short handles like `intern1` show where an email should.

## New structure

### Navigation

| Who | Today | New |
| --- | --- | --- |
| Manager, master | Overview · Interns · Modules · Assign · Schedule | **Team** · **Library** · **Schedule** · **My learning** |
| Intern | My modules · Schedule | **Today** · **My learning** · **Schedule** |
| Employee with no reports (later) | none | **My learning** only |

- Desktop: keep the top bar. Phone (under 768px): fixed bottom tab bar with icon and label, account menu behind the avatar.
- Master gets a **Settings** entry in the avatar menu (staff list, roles, demo data).
- Routes: `/team`, `/team/[id]`, `/library`, `/schedule`, `/learning`, `/today`, `/settings`. Redirect the old `/admin/*` and `/onboarding` paths.

### Team (replaces Overview, Interns and Assign)

One list, one row per person, grouped "Interns" and "Staff".

- Each row: name, status chip (**On track**, **Behind**, **Not started**, **No modules**), progress such as "2 of 4 done", and for interns today's state (**Clocked in 9:02**, **Remote 9–5**, **Out**, **No plan**).
- Filter chips above the list: Mine / Everyone (master and managers), Behind only.
- Top of page: one line of summary ("1 behind · 2 working today"), not three cards.
- One primary button: **Add person**.
- Bulk: tick several rows, then **Send modules**. This replaces "Send to my interns".
- No trash icon and no "Assign to me" on rows.

### Person page (`/team/[id]`)

Everything about one person, in this order:

1. Header: name, email, role, managers. Overflow menu holds: Add me as manager / Remove me, Reset PIN, Change role (master), Remove account (typed-name confirm).
2. **Learning**: the existing checkbox list, plus an optional due date per module and the date each status changed. Save applies immediately per row (no separate Save button), with an undo toast.
3. **This week** (interns only): the same five-day strip as the Schedule page, editable here.

### Add person (replaces the invite form)

One sheet, three short steps on a single screen:

1. Email, name, type (Intern / Manager; Manager is master-only).
2. Modules to send now (checkboxes, optional, with a "same as…" picker to copy another person's set).
3. Result: the PIN with **Copy invite** (copies a ready message: link, email, PIN). The PIN stays retrievable through **Reset PIN** on the person page, which issues a new one.

### Library (was Modules)

- Cards show title, description, link count, and "Sent to 3 · 1 finished". Raw URLs collapse to the link title with the domain in muted text.
- **Send** on each card opens the people picker, so a manager can go from "this module" to "these people" as well as the other way round.
- Delete moves into the edit sheet and warns when the module is assigned to someone.

### Schedule (staff)

Merge the two tables into one grid. Each cell shows the plan on the first line and worked hours on the second:

```
            Mon 9         Tue 10        Wed 11 · today
Intern 1    Remote 9–5    On site 9–5   On site 9–5
            7:45          8:10          in since 9:02
```

- Cell tint by status; a warning dot for "needs review" (open from an earlier day, or over 12 hours).
- Click a cell: one popover with the plan on top and that day's sessions below. Replaces the separate "Edit schedule" and "Edit sessions" dialogs.
- Week editor shortcuts: **Apply Monday to all days**, **Copy last week**, and a status picker that pre-fills 9:00–5:00 so one click sets a day.
- Session editor: time-only inputs (the date is already known from the cell).
- Phone: switch to one day at a time with a day picker across the top, a list of people underneath. No sideways scrolling.

### Intern side (verify against the live pages first)

- **Today** is the landing page: a large Clock in / Clock out button with the running timer, today's plan, and the next unfinished module.
- **Schedule**: the same week editor with the same shortcuts, plus "Repeat this week for the next N weeks" (up to the 8-week limit).
- **My learning**: modules with due dates, soonest first; Finished collapses to the bottom.

### My learning for staff

The same page interns use, shown to managers and the master when they have assignments. A manager sees who sent each module.

## Permissions after the change

| Action | Master | Manager | Intern |
| --- | --- | --- | --- |
| See own learning, mark progress | yes | yes | yes |
| Send modules to an intern | any | own interns | no |
| Send modules to a manager | any | any manager | no |
| See a manager's learning progress | all | only modules they sent | no |
| Plan week, clock time | no | no | yes |
| See schedule and hours | all interns | own interns | own |
| Edit library | yes | yes | no |
| Staff list, roles, demo data | yes | no | no |

## Schema the redesign starts from

Checked against production on 2026-11-11. Do not add columns that are already there, and do not rename the ones below.

- The manager role value stays `admin`. The screen says Manager.
- `assignments.intern_id` stays the column name, including when the assignee is staff.
- `assignments` already has `assigned_by`, `started_at`, and `completed_at`. The only missing assignment column is `due_date date null`.
- These module columns stay: `slug`, `platform`, `content`, `estimated_minutes`, `is_published`.
  - The app writes `slug` from the title, and writes `content` as an empty string, when a module is created. It writes `title` and `description` on create and edit.
  - The app does not read or write `platform`, `estimated_minutes`, or `is_published`. It does not show `content`. The links on screen are `module_links`.
- Not in the database yet: `profiles.tracks_time`, `assignments.due_date`, a `team_status` view, a PIN reset function, and functions to add, revoke, or restore a staff address.

## Database changes (Supabase, as migrations)

1. `profiles.tracks_time boolean not null default false`; backfill `true` for interns. Schedule and clock policies check this flag, not the role.
2. Add `assignments.due_date date null` only. Leave `assigned_by`, `started_at`, `completed_at`, `intern_id`, and the `admin` role value as they are.
3. Assignment RLS: allow `admin` and `master` to insert/update/delete rows where the target profile's role is `admin` or `master`; allow a manager to select staff assignments where `assigned_by = auth.uid()`; let every user select and update status on their own rows. Today any manager can select every assignment, and `can_manage_intern` only succeeds when the target role is `intern`.
4. Remove the redirect that sends staff away from the learner page.
5. Staff allowlist: master-only RPCs to add, revoke and restore an address, used by the Settings screen.
6. PIN reset RPC for a person's manager or the master.
7. A view (or RPC) `team_status` returning per person: assigned, finished, overdue count, today's plan, open session. The Team page reads this one source.
8. Demo accounts: move creation into `supabase/seed.sql`; drop the "cannot be deleted" rule in production.

## Visual and brand

Keep what is already distinctive: the dark surface, the round M mark, the thin rainbow line. Tighten the rest:

- One primary (white) button per screen. Everything else is quiet.
- Status colors used the same way everywhere: green finished/on track, amber started/remote, red behind/needs review, grey not set.
- Rows and tap targets at least 44px high on phone.
- Replace page-intro paragraphs with a single short line, or nothing.
- Empty states say what to do next ("No plan for this week · Set week").

## Phases

| Phase | Ships | Touches DB |
| --- | --- | --- |
| 0. Setup | Supabase connected to Cursor, migrations in the repo, preview environment, rename to Marketing Hub | no |
| 0.5 History and local DB | Parked. The repair plan and local Supabase config stay in the repo and move to Phase 5. | none until Phase 5 |
| 1. Team and person page | New Team list, person page, Add person sheet; remove Overview, Interns, Assign tabs. Status is computed in the app until a view is approved. | none until approved |
| 2. Schedule | Merged grid, cell popover, week shortcuts, phone day view | no |
| 3. Learning for staff | My learning for all roles, manager-to-manager sending, due dates | yes |
| 4. Phone pass | Bottom tab bar, Team and Schedule at 375px, intern Today page | no |
| 5. Settings and cleanup | Staff list screen, demo accounts out, old routes redirected, migration history repair, local Supabase | yes |

Acceptance checks to give Cursor for every phase: works at 375px and 1280px with no sideways scroll; a manager can add an intern, send modules and hand over the PIN without leaving one sheet; setting a full week takes at most three clicks; RLS tests pass for master, manager and intern.

## Running everything from Cursor

- **GitHub**: already connected. Work on a branch per phase and open a PR for each.
- **Supabase**: add the Supabase MCP server in Cursor (Settings → MCP → add server, type `http`, URL `https://mcp.supabase.com/mcp`, then sign in when prompted). Scope it to this one project.
- Until real users start, build against the live project `manamarketingplatform`.
- Apply database changes through the Supabase plugin. Do not use `supabase db push`.
- Show the SQL and wait for approval before applying it. Save the same SQL as a file in `supabase/migrations` in the commit that applies it.
- Additive changes only. Ask before dropping or renaming anything.
- Leave `platform`, `estimated_minutes`, `is_published`, and `content` untouched.
- Migration history repair and the local Supabase stack wait until Phase 5.
- First prompt for Cursor: "Read `docs/redesign-brief.md`. Pull the current schema and RLS policies into `supabase/migrations` as a baseline, list any differences from the brief's assumptions, then propose the Phase 0 PR. Do not change production."

## Open items for the owner

1. Confirm the name (Marketing Hub, or another).
2. Confirm decision 2: should managers see each other's progress, or only the sender and the master?
3. An intern PIN login for a live pass over the intern pages before Phase 4.
