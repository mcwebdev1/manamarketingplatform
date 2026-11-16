"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { createInternAccount, createManagerAccount } from "@/lib/actions/people"
import { sendModules } from "@/lib/actions/assignments"
import { copy } from "@/lib/copy"
import { resolveLogin } from "@/lib/login"
import type { InviteCredentials } from "@/lib/invite"
import { isMaster, type UserRole } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

type ModuleChoice = { id: string; title: string }
type PersonChoice = { id: string; name: string; moduleIds: string[] }

export function AddPersonSheet({
  open,
  onOpenChange,
  modules,
  people,
  currentRole,
  currentAdminId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  modules: ModuleChoice[]
  people: PersonChoice[]
  currentRole: UserRole
  currentAdminId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [kind, setKind] = useState<"intern" | "admin">("intern")
  const [selected, setSelected] = useState<string[]>([])
  const [sameAs, setSameAs] = useState("none")
  const [invite, setInvite] = useState<InviteCredentials | null>(null)
  const master = isMaster(currentRole)

  function reset() {
    setEmail("")
    setFullName("")
    setKind("intern")
    setSelected([])
    setSameAs("none")
    setInvite(null)
  }

  function close(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function create() {
    const trimmedEmail = email.trim()
    const trimmedName = fullName.trim()
    if (!trimmedEmail) {
      toast.error(copy.addPerson.emailRequired)
      return
    }
    if (!trimmedName) {
      toast.error(copy.addPerson.nameRequired)
      return
    }
    startTransition(async () => {
      const created =
        kind === "admin"
          ? await createManagerAccount({ email: trimmedEmail, fullName: trimmedName })
          : await createInternAccount({
              email: trimmedEmail,
              fullName: trimmedName,
              managerIds: [currentAdminId],
            })
      if ("error" in created) {
        toast.error(created.error)
        return
      }
      if (kind === "intern" && selected.length) {
        const sent = await sendModules([created.invite.id], selected)
        if ("error" in sent) toast.error(copy.addPerson.modulesFailed)
      }
      setInvite(created.invite)
      router.refresh()
    })
  }

  async function copyInvite() {
    if (!invite) return
    await navigator.clipboard.writeText(
      copy.addPerson.inviteMessage(resolveLogin(invite.email), invite.pin)
    )
    toast.success(copy.addPerson.inviteCopied)
  }

  return (
    <Sheet open={open} onOpenChange={close}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{copy.addPerson.title}</SheetTitle>
          <SheetDescription className="sr-only">{copy.addPerson.title}</SheetDescription>
        </SheetHeader>
        {invite ? (
          <div className="space-y-4 px-4 pb-6">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{copy.addPerson.email}</p>
              <p className="font-medium">{resolveLogin(invite.email)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{copy.addPerson.pin}</p>
              <p className="font-mono text-2xl tracking-[0.3em]">{invite.pin}</p>
            </div>
            <Button type="button" className="h-11 w-full cursor-pointer" onClick={copyInvite}>
              {copy.addPerson.copyInvite}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full cursor-pointer"
              onClick={reset}
            >
              {copy.addPerson.addAnother}
            </Button>
          </div>
        ) : (
          <form
            className="space-y-6 px-4 pb-6"
            onSubmit={(event) => {
              event.preventDefault()
              create()
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="person-email">{copy.addPerson.email}</Label>
              <Input
                id="person-email"
                className="h-11"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="person-name">{copy.addPerson.name}</Label>
              <Input
                id="person-name"
                className="h-11"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="off"
              />
            </div>
            {master ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">{copy.addPerson.type}</p>
                <div className="grid grid-cols-2 gap-2">
                  {(["intern", "admin"] as const).map((option) => (
                    <Button
                      key={option}
                      type="button"
                      variant={kind === option ? "default" : "outline"}
                      className="h-11 cursor-pointer"
                      onClick={() => setKind(option)}
                    >
                      {option === "intern" ? copy.roles.intern : copy.roles.admin}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {kind === "intern" ? (
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium">{copy.addPerson.modules}</legend>
                <Select
                  value={sameAs}
                  onValueChange={(value) => {
                    setSameAs(value)
                    const match = people.find((person) => person.id === value)
                    setSelected(match ? match.moduleIds : [])
                  }}
                >
                  <SelectTrigger className="w-full cursor-pointer data-[size=default]:h-11" aria-label={copy.addPerson.sameAs}>
                    <SelectValue placeholder={copy.addPerson.sameAs} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="min-h-11">
                      {copy.addPerson.none}
                    </SelectItem>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id} className="min-h-11">
                        {copy.addPerson.sameAs} {person.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ul className="space-y-1">
                  {modules.map((module) => (
                    <li key={module.id}>
                      <label className="flex min-h-11 items-center gap-3">
                        <Checkbox
                          className="size-5"
                          checked={selected.includes(module.id)}
                          onCheckedChange={(value) => {
                            setSameAs("none")
                            setSelected((current) =>
                              value === true
                                ? [...current, module.id]
                                : current.filter((id) => id !== module.id)
                            )
                          }}
                        />
                        <span>{module.title}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}
            <Button type="submit" className="h-11 w-full cursor-pointer" disabled={pending}>
              {copy.addPerson.title}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  )
}
