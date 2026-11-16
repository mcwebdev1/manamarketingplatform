import { TeamList, type TeamPerson } from "@/components/team/team-list"
import { requireAdmin } from "@/lib/auth"
import { canManageIntern } from "@/lib/access"
import { copy } from "@/lib/copy"
import { displayLogin } from "@/lib/login"
import {
  addDays,
  localToday,
  weekStartOf,
  type ReportSession,
} from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"
import {
  isWorkingToday,
  personNeedsReview,
  todayLine,
  trackStatus,
  weekIsSet,
  type ScheduleSlice,
} from "@/lib/team-status"
import {
  internName,
  isManagedBy,
  isMaster,
  managerIdsForIntern,
  type AssignmentStatus,
  type ScheduleStatus,
} from "@/lib/types"

export const metadata = { title: copy.team.title }

export default async function TeamPage() {
  const admin = await requireAdmin()
  const supabase = await createClient()
  const today = localToday()
  const weekStart = weekStartOf(today)
  const weekEnd = addDays(weekStart, 4)

  const [profiles, links, assignments, modules] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role").order("full_name"),
    supabase.from("intern_managers").select("intern_id, manager_id"),
    supabase.from("assignments").select("intern_id, module_id, status"),
    supabase.from("modules").select("id, title").order("sort_order").order("title"),
  ])
  const error = profiles.error ?? links.error ?? assignments.error ?? modules.error
  if (error) {
    return <p className="text-sm text-muted-foreground">{copy.team.loadError}</p>
  }

  const internIds = (profiles.data ?? [])
    .filter((person) => person.role === "intern")
    .map((person) => person.id)

  const schedules = internIds.length
    ? await supabase
        .from("schedules")
        .select("intern_id, day, status, start_time, end_time")
        .in("intern_id", internIds)
        .eq("week_start", weekStart)
    : { data: [], error: null }
  const sessions = internIds.length
    ? await supabase
        .from("time_logs")
        .select("id, intern_id, work_date, clock_in, clock_out, actual_hours")
        .in("intern_id", internIds)
        .or(`clock_out.is.null,and(work_date.gte.${weekStart},work_date.lte.${weekEnd})`)
    : { data: [], error: null }
  if (schedules.error || sessions.error) {
    return <p className="text-sm text-muted-foreground">{copy.team.loadError}</p>
  }

  const nowMs = Date.now()
  const linkRows = links.data ?? []
  const assignmentRows = assignments.data ?? []
  const scheduleRows = schedules.data ?? []
  const sessionRows = (sessions.data ?? []) as (ReportSession & { intern_id: string })[]

  const people: TeamPerson[] = (profiles.data ?? [])
    .map((person) => {
      const mine = isManagedBy(linkRows, person.id, admin.id)
      const isIntern = person.role === "intern"
      const canSeeTime = isIntern && (isMaster(admin.role) || mine)
      const personAssignments = assignmentRows.filter((row) => row.intern_id === person.id)
      const personDays = scheduleRows
        .filter((row) => row.intern_id === person.id)
        .map((row) => row.day)
      const personSessions = sessionRows.filter((row) => row.intern_id === person.id)
      const open = personSessions.find((row) => row.clock_out === null) ?? null
      const todaySchedule = scheduleRows.find(
        (row) => row.intern_id === person.id && row.day === today
      )
      const schedule: ScheduleSlice | null = todaySchedule
        ? {
            day: todaySchedule.day,
            status: todaySchedule.status as ScheduleStatus,
            start_time: todaySchedule.start_time,
            end_time: todaySchedule.end_time,
          }
        : null
      const done = personAssignments.filter((row) => row.status === "completed").length
      const started = personAssignments.filter(
        (row) => (row.status as AssignmentStatus) !== "not_started"
      ).length

      return {
        id: person.id,
        name: internName(person),
        login: displayLogin(person.email),
        role: person.role,
        group: isIntern ? ("intern" as const) : ("staff" as const),
        mine,
        canSend: isIntern && canManageIntern(admin, managerIdsForIntern(linkRows, person.id)),
        track: trackStatus({
          isIntern,
          canSeeTime,
          assignmentCount: personAssignments.length,
          startedCount: started,
          weekSet: weekIsSet(personDays, weekStart),
          needsReview: personNeedsReview(personSessions, today, nowMs),
        }),
        progress: personAssignments.length
          ? copy.team.progress(done, personAssignments.length)
          : null,
        today: canSeeTime ? todayLine(schedule, open) : null,
        working: canSeeTime && isWorkingToday(schedule, open, today),
        moduleIds: personAssignments.map((row) => row.module_id),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const behind = people.filter((person) => person.track === "behind").length
  const working = people.filter((person) => person.working).length

  return (
    <TeamList
      people={people}
      modules={modules.data ?? []}
      summary={copy.team.summary(behind, working)}
      currentRole={admin.role}
      currentAdminId={admin.id}
    />
  )
}
