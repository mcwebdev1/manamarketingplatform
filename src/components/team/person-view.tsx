"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import {
  claimIntern,
  changeUserRole,
  deleteInternAccount,
  deleteManagerAccount,
  unclaimIntern,
} from "@/lib/actions/people"
import { restorePersonModule, setPersonModule } from "@/lib/actions/assignments"
import { USER_ROLES } from "@/lib/access"
import { copy } from "@/lib/copy"
import { assignmentWhen, roleCopy } from "@/lib/team-status"
import {
  internName,
  isManagedBy,
  isMaster,
  managersLabel,
  type AssignmentStatus,
  type Module,
  type Profile,
  type UserRole,
} from "@/lib/types"
import { PersonWeek } from "@/components/team/person-week"
import type { SavedScheduleDay } from "@/components/schedule/week-days-editor"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AssignmentRow = {
  id: string
  module_id: string
  status: AssignmentStatus
  started_at: string | null
  completed_at: string | null
}

type SavedModule = {
  status: AssignmentStatus
  started_at: string | null
  completed_at: string | null
  assigned_by: string | null
}

export function PersonView({
  person,
  modules,
  assignments,
  managers,
  weekStart,
  today,
  savedDays,
  currentAdminId,
  currentRole,
  canChangeRoles,
}: {
  person: Profile
  modules: Pick<Module, "id" | "title">[]
  assignments: AssignmentRow[]
  managers: Profile[]
  weekStart: string
  today: string
  savedDays: SavedScheduleDay[]
  currentAdminId: string
  currentRole: UserRole
  canChangeRoles: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selected, setSelected] = useState(() => new Set(assignments.map((row) => row.module_id)))
  const [claimOpen, setClaimOpen] = useState(false)
  const [queuedModule, setQueuedModule] = useState<string | null>(null)
  const [roleOpen, setRoleOpen] = useState(false)
  const [nextRole, setNextRole] = useState<UserRole>(person.role)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [typedName, setTypedName] = useState("")
  const name = internName(person)
  const mine = isManagedBy(
    managers.map((manager) => ({ intern_id: person.id, manager_id: manager.id })),
    person.id,
    currentAdminId
  )
  const intern = person.role === "intern"
  const canSend = intern && (mine || isMaster(currentRole))
  const canRemove = intern ? mine || isMaster(currentRole) : isMaster(currentRole)
  const self = person.id === currentAdminId
  const hasMenu = !self && (intern || canChangeRoles || canRemove)
  const visibleModules = modules.filter(
    (module) => intern || assignments.some((row) => row.module_id === module.id)
  )

  function toggleModule(moduleId: string, assigned: boolean) {
    if (!canSend) {
      setQueuedModule(moduleId)
      setClaimOpen(true)
      return
    }
    const previous = assignments.find((row) => row.module_id === moduleId) ?? null
    setSelected((current) => {
      const next = new Set(current)
      if (assigned) next.add(moduleId)
      else next.delete(moduleId)
      return next
    })
    startTransition(async () => {
      const result = await setPersonModule(person.id, moduleId, assigned)
      if ("error" in result) {
        toast.error(result.error)
        setSelected((current) => {
          const next = new Set(current)
          if (assigned) next.delete(moduleId)
          else next.add(moduleId)
          return next
        })
        return
      }
      toast.success(assigned ? copy.person.moduleSent : copy.person.moduleRemoved, {
        action: {
          label: copy.person.undo,
          onClick: () => {
            startTransition(async () => {
              const undone = await restorePersonModule(
                person.id,
                moduleId,
                assigned ? null : savedFrom(previous)
              )
              if ("error" in undone) toast.error(undone.error)
              else router.refresh()
            })
          },
        },
      })
      router.refresh()
    })
  }

  function confirmClaim() {
    startTransition(async () => {
      const result = mine ? await unclaimIntern(person.id) : await claimIntern(person.id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      if (queuedModule) {
        const sent = await setPersonModule(person.id, queuedModule, true)
        if ("error" in sent) toast.error(sent.error)
        setQueuedModule(null)
      }
      setClaimOpen(false)
      router.refresh()
    })
  }

  function confirmRole() {
    startTransition(async () => {
      const result = await changeUserRole(person.id, nextRole)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(copy.person.roleSaved)
      setRoleOpen(false)
      router.refresh()
    })
  }

  function confirmRemove() {
    startTransition(async () => {
      const result = intern
        ? await deleteInternAccount(person.id)
        : await deleteManagerAccount(person.id)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      toast.success(copy.person.accountRemoved)
      router.push("/team")
    })
  }

  return (
    <div className="space-y-10">
      <Link
        href="/team"
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {copy.person.back}
      </Link>

      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{person.email}</p>
          <p className="mt-3 text-sm">{roleCopy(person.role)}</p>
          {intern ? (
            <p className="text-sm text-muted-foreground">
              {managers.length
                ? `${copy.person.managers}: ${managersLabel(managers)}`
                : copy.person.noManager}
            </p>
          ) : null}
        </div>
        {hasMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 cursor-pointer"
                aria-label={copy.person.more}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {intern ? (
                <DropdownMenuItem
                  className="min-h-11"
                  onSelect={() => {
                    setQueuedModule(null)
                    setClaimOpen(true)
                  }}
                >
                  {mine ? copy.person.removeMe : copy.person.addMe}
                </DropdownMenuItem>
              ) : null}
              {canChangeRoles ? (
                <DropdownMenuItem className="min-h-11" onSelect={() => setRoleOpen(true)}>
                  {copy.person.changeRole}
                </DropdownMenuItem>
              ) : null}
              {canRemove ? (
                <DropdownMenuItem
                  className="min-h-11"
                  variant="destructive"
                  onSelect={() => setRemoveOpen(true)}
                >
                  {copy.person.removeAccount}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">{copy.person.learning}</h2>
        {visibleModules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.person.noModules}</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl ring-1 ring-foreground/10">
            {visibleModules.map((module) => {
              const assignment = assignments.find((row) => row.module_id === module.id)
              const checked = selected.has(module.id)
              const when = assignment
                ? assignmentWhen(assignment.status, assignment.started_at, assignment.completed_at)
                : null
              return (
                <li key={module.id} className="flex min-h-11 items-center gap-3 px-4 py-2">
                  {intern ? (
                    <Checkbox
                      className="size-5"
                      checked={checked}
                      disabled={pending}
                      aria-label={module.title}
                      onCheckedChange={(value) => toggleModule(module.id, value === true)}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{module.title}</p>
                    {when ? <p className="text-sm text-muted-foreground">{when}</p> : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {intern ? (
        <PersonWeek
          personId={person.id}
          weekStart={weekStart}
          today={today}
          saved={savedDays}
          canEdit={canSend}
        />
      ) : null}

      <Dialog
        open={claimOpen}
        onOpenChange={(open) => {
          setClaimOpen(open)
          if (!open) setQueuedModule(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mine ? copy.person.unclaimTitle(name) : copy.person.claimTitle(name)}
            </DialogTitle>
            <DialogDescription>
              {mine ? copy.person.unclaimBody : copy.person.claimBody}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-4"
              onClick={() => setClaimOpen(false)}
            >
              {mine ? copy.person.keepMe : copy.person.cancel}
            </Button>
            <Button
              type="button"
              className="h-11 cursor-pointer px-4"
              variant={mine ? "destructive" : "default"}
              disabled={pending}
              onClick={confirmClaim}
            >
              {mine ? copy.person.removeMe : copy.person.addMe}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleOpen} onOpenChange={setRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.person.changeRoleTitle(name)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="role">{copy.person.role}</Label>
            <Select value={nextRole} onValueChange={(value) => setNextRole(value as UserRole)}>
              <SelectTrigger id="role" className="h-11 w-full cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role} className="min-h-11">
                    {roleCopy(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-4"
              onClick={() => setRoleOpen(false)}
            >
              {copy.person.cancel}
            </Button>
            <Button
              type="button"
              className="h-11 cursor-pointer px-4"
              disabled={pending || nextRole === person.role}
              onClick={confirmRole}
            >
              {copy.person.saveRole}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{copy.person.removeTitle(name)}</DialogTitle>
            <DialogDescription>{copy.person.removeHint(name)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-name">{copy.person.name}</Label>
            <Input
              id="confirm-name"
              className="h-11"
              value={typedName}
              onChange={(event) => setTypedName(event.target.value)}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 cursor-pointer px-4"
              onClick={() => setRemoveOpen(false)}
            >
              {copy.person.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 cursor-pointer px-4"
              disabled={pending || typedName.trim() !== name}
              onClick={confirmRemove}
            >
              {copy.person.removeAccount}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function savedFrom(row: AssignmentRow | null): SavedModule | null {
  if (!row) return null
  return {
    status: row.status,
    started_at: row.started_at,
    completed_at: row.completed_at,
    assigned_by: null,
  }
}

