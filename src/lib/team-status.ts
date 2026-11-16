// Team list status, computed from the tables that already exist.
// A due date is not stored yet, so nobody is behind on modules.
// An intern is behind when this week is missing a day, or a session needs
// review (still open from an earlier day, or longer than 12 hours).
// A session opened today does not, on its own, mark them behind.
import { copy } from "@/lib/copy"
import {
  formatClockTime,
  isWeekSet,
  localToday,
  sessionNeedsReview,
  toTimeInput,
  type ReportSession,
} from "@/lib/schedule"
import type { AssignmentStatus, ScheduleStatus, UserRole } from "@/lib/types"

export type TrackStatus = keyof typeof copy.team.statuses

export type ScheduleSlice = {
  day: string
  status: ScheduleStatus
  start_time: string | null
  end_time: string | null
}

export function trackStatus(input: {
  isIntern: boolean
  canSeeTime: boolean
  assignmentCount: number
  startedCount: number
  weekSet: boolean
  needsReview: boolean
}): TrackStatus {
  if (input.isIntern && input.canSeeTime && (!input.weekSet || input.needsReview)) {
    return "behind"
  }
  if (input.assignmentCount === 0) return "no_modules"
  if (input.startedCount === 0) return "not_started"
  return "on_track"
}

export function compactRange(start: string | null, end: string | null) {
  const startTime = toTimeInput(start)
  const endTime = toTimeInput(end)
  if (!startTime || !endTime) return null
  return `${compactClock(startTime)}-${compactClock(endTime)}`
}

function compactClock(value: string) {
  const [hourText, minute] = value.split(":")
  const hour = Number(hourText)
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  return minute === "00" ? String(hour12) : `${hour12}:${minute}`
}

export function todayLine(
  schedule: ScheduleSlice | null | undefined,
  openSession: { clock_in: string; work_date: string } | null
) {
  if (openSession && openSession.work_date === localToday(new Date(openSession.clock_in))) {
    return copy.team.clockedIn(formatClockTime(openSession.clock_in))
  }
  if (openSession) return copy.team.clockedIn(formatClockTime(openSession.clock_in))
  if (!schedule) return copy.team.noPlan
  const range = compactRange(schedule.start_time, schedule.end_time)
  if (schedule.status === "remote") return range ? copy.team.remote(range) : copy.team.remoteWord
  if (schedule.status === "available") return range ? copy.team.onSite(range) : copy.team.onSiteWord
  if (schedule.status === "out") return copy.team.out
  if (schedule.status === "unavailable") return copy.team.unavailable
  return copy.team.noPlan
}

export function isWorkingToday(
  schedule: ScheduleSlice | null | undefined,
  openSession: { work_date: string } | null,
  today: string
) {
  if (openSession?.work_date === today) return true
  return schedule?.status === "available" || schedule?.status === "remote"
}

export function assignmentWhen(
  status: AssignmentStatus,
  startedAt: string | null,
  completedAt: string | null
) {
  if (status === "completed" && completedAt) {
    return copy.person.finished(formatStatusDate(completedAt))
  }
  if (status === "in_progress" && startedAt) {
    return copy.person.started(formatStatusDate(startedAt))
  }
  if (status === "completed" && startedAt) {
    return copy.person.finished(formatStatusDate(startedAt))
  }
  return null
}

function formatStatusDate(iso: string) {
  const day = localToday(new Date(iso))
  const [year, month, date] = day.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, date)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function personNeedsReview(sessions: ReportSession[], today: string, nowMs: number) {
  return sessions.some((session) => sessionNeedsReview(session, today, nowMs))
}

export function weekIsSet(days: Iterable<string>, weekStart: string) {
  return isWeekSet(days, weekStart)
}

export function roleCopy(role: UserRole) {
  return copy.roles[role]
}
