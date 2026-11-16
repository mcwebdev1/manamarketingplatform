"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { overrideInternSchedule } from "@/lib/actions/admin-schedule"
import { copy } from "@/lib/copy"
import {
  WEEKDAY_LABELS,
  formatDateLabel,
  weekDays,
} from "@/lib/schedule"
import { todayLine, type ScheduleSlice } from "@/lib/team-status"
import {
  EMPTY_DRAFT,
  WeekDaysEditor,
  draftFromSaved,
  sameDraft,
  toEntry,
  type Draft,
  type SavedScheduleDay,
} from "@/components/schedule/week-days-editor"
import { Button } from "@/components/ui/button"

export function PersonWeek({
  personId,
  weekStart,
  today,
  saved,
  canEdit,
}: {
  personId: string
  weekStart: string
  today: string
  saved: SavedScheduleDay[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => initialDrafts(weekStart, saved))
  const days = weekDays(weekStart)
  const dirty = days.some((day) => !sameDraft(drafts[day] ?? EMPTY_DRAFT, draftFromSaved(saved.find((row) => row.day === day))))
  const empty = saved.length === 0

  function save() {
    startTransition(async () => {
      const result = await overrideInternSchedule(
        personId,
        weekStart,
        days.map((day) => toEntry(day, drafts[day] ?? EMPTY_DRAFT))
      )
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(copy.person.weekSaved)
      router.refresh()
    })
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{copy.person.thisWeek}</h2>
        {canEdit ? (
          <Button
            type="button"
            className="h-11 cursor-pointer px-4"
            disabled={pending || !dirty}
            onClick={save}
          >
            {empty ? copy.person.setWeek : copy.person.saveWeek}
          </Button>
        ) : null}
      </div>
      {empty ? <p className="text-sm text-muted-foreground">{copy.person.noPlan}</p> : null}
      {canEdit ? (
        <WeekDaysEditor
          weekStart={weekStart}
          today={today}
          draftFor={(day) => drafts[day] ?? EMPTY_DRAFT}
          onChange={(day, draft) => setDrafts((current) => ({ ...current, [day]: draft }))}
          isDirty={(day) =>
            !sameDraft(drafts[day] ?? EMPTY_DRAFT, draftFromSaved(saved.find((row) => row.day === day)))
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
          {days.map((day, index) => {
            const row = saved.find((item) => item.day === day)
            return (
              <li key={day} className="flex min-h-11 items-center justify-between gap-3 px-4">
                <span>
                  <span className="font-medium">{WEEKDAY_LABELS[index]}</span>
                  <span className="ml-2 text-sm text-muted-foreground">{formatDateLabel(day)}</span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {row ? todayLine(row as ScheduleSlice, null) : copy.team.noPlan}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function initialDrafts(weekStart: string, saved: SavedScheduleDay[]) {
  return Object.fromEntries(
    weekDays(weekStart).map((day) => [day, draftFromSaved(saved.find((row) => row.day === day))])
  )
}
