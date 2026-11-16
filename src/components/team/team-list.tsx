"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { sendModules } from "@/lib/actions/assignments"
import { copy } from "@/lib/copy"
import type { TrackStatus } from "@/lib/team-status"
import type { UserRole } from "@/lib/types"
import { AddPersonSheet } from "@/components/team/add-person-sheet"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

export type TeamPerson = {
  id: string
  name: string
  login: string
  role: UserRole
  group: "intern" | "staff"
  mine: boolean
  canSend: boolean
  track: TrackStatus
  progress: string | null
  today: string | null
  working: boolean
  moduleIds: string[]
}

type Filter = "mine" | "everyone" | "behind"

const chipClass =
  "inline-flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors"

export function TeamList({
  people,
  modules,
  summary,
  currentRole,
  currentAdminId,
}: {
  people: TeamPerson[]
  modules: { id: string; title: string }[]
  summary: string
  currentRole: UserRole
  currentAdminId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [filter, setFilter] = useState<Filter>(people.some((person) => person.mine) ? "mine" : "everyone")
  const [selected, setSelected] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [sendOpen, setSendOpen] = useState(false)
  const [moduleIds, setModuleIds] = useState<string[]>([])

  const visible = people.filter((person) => {
    if (filter === "mine") return person.mine
    if (filter === "behind") return person.track === "behind"
    return true
  })
  const interns = visible.filter((person) => person.group === "intern")
  const staff = visible.filter((person) => person.group === "staff")
  const sending = selected.length > 0

  function togglePerson(id: string, on: boolean) {
    setSelected((current) => (on ? [...current, id] : current.filter((item) => item !== id)))
  }

  function send() {
    if (moduleIds.length === 0) {
      toast.error(copy.team.chooseModule)
      return
    }
    startTransition(async () => {
      const result = await sendModules(selected, moduleIds)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(copy.team.modulesSent)
      setSendOpen(false)
      setSelected([])
      setModuleIds([])
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{copy.team.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
        </div>
        <Button
          type="button"
          variant={sending ? "outline" : "default"}
          className="h-11 cursor-pointer px-4"
          onClick={() => setAddOpen(true)}
        >
          {copy.team.addPerson}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["mine", copy.team.mine],
            ["everyone", copy.team.everyone],
            ["behind", copy.team.behindOnly],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={cn(
              chipClass,
              filter === value ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
            )}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {people.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.team.empty}</p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.team.emptyFilter}</p>
      ) : (
        <div className="space-y-8">
          <Group title={copy.team.interns} people={interns} selected={selected} onToggle={togglePerson} />
          <Group title={copy.team.staff} people={staff} selected={selected} onToggle={togglePerson} />
        </div>
      )}

      {sending ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button type="button" className="h-11 cursor-pointer px-4" onClick={() => setSendOpen(true)}>
            {copy.team.sendModules}
          </Button>
        </div>
      ) : null}

      <AddPersonSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        modules={modules}
        people={people.filter((person) => person.moduleIds.length > 0)}
        currentRole={currentRole}
        currentAdminId={currentAdminId}
      />

      <Sheet open={sendOpen} onOpenChange={setSendOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{copy.team.sendModules}</SheetTitle>
            <SheetDescription className="sr-only">{copy.team.sendModules}</SheetDescription>
          </SheetHeader>
          <ul className="space-y-1 px-4">
            {modules.map((module) => (
              <li key={module.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    className="size-5"
                    checked={moduleIds.includes(module.id)}
                    onCheckedChange={(value) =>
                      setModuleIds((current) =>
                        value === true
                          ? [...current, module.id]
                          : current.filter((id) => id !== module.id)
                      )
                    }
                  />
                  <span>{module.title}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="p-4">
            <Button type="button" className="h-11 w-full cursor-pointer" disabled={pending} onClick={send}>
              {copy.team.sendModules}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

function Group({
  title,
  people,
  selected,
  onToggle,
}: {
  title: string
  people: TeamPerson[]
  selected: string[]
  onToggle: (id: string, on: boolean) => void
}) {
  if (people.length === 0) return null
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-3">
            {person.canSend ? (
              <Checkbox
                className="size-5"
                checked={selected.includes(person.id)}
                aria-label={person.name}
                onCheckedChange={(value) => onToggle(person.id, value === true)}
              />
            ) : (
              <span className="size-5 shrink-0" />
            )}
            <Link
              href={`/team/${person.id}`}
              className="flex min-h-14 min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3"
            >
              <span className="min-w-0">
                <span className="block font-medium">{person.name}</span>
                {person.today ? (
                  <span className="block text-sm text-muted-foreground">{person.today}</span>
                ) : null}
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <StatusChip status={person.track} />
                {person.progress ? (
                  <span className="text-sm text-muted-foreground">{person.progress}</span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function StatusChip({ status }: { status: TrackStatus }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium",
        status === "on_track" && "bg-[#4EAD63]/15 text-[#8BDB9A]",
        status === "behind" && "bg-[#EB4B80]/15 text-[#F3A3C0]",
        (status === "not_started" || status === "no_modules") && "bg-muted text-muted-foreground"
      )}
    >
      {copy.team.statuses[status]}
    </span>
  )
}
