import { notFound } from "next/navigation"
import { PersonView } from "@/components/team/person-view"
import { isGoogleMasterSession, requireAdmin } from "@/lib/auth"
import { copy } from "@/lib/copy"
import { localToday, weekDays, weekStartOf } from "@/lib/schedule"
import { createClient } from "@/lib/supabase/server"
import { internManagerProfiles, internName } from "@/lib/types"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase.from("profiles").select("full_name, email").eq("id", id).maybeSingle()
  return { title: data ? internName(data) : copy.team.title }
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = await requireAdmin()
  const supabase = await createClient()
  const today = localToday()
  const weekStart = weekStartOf(today)

  const [person, modules, assignments, managers, links, schedules, canChangeRoles] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("modules").select("id, title").order("sort_order").order("title"),
      supabase
        .from("assignments")
        .select("id, module_id, status, started_at, completed_at")
        .eq("intern_id", id),
      supabase.from("profiles").select("*").in("role", ["admin", "master"]).order("full_name"),
      supabase.from("intern_managers").select("intern_id, manager_id").eq("intern_id", id),
      supabase
        .from("schedules")
        .select("day, status, start_time, end_time")
        .eq("intern_id", id)
        .in("day", weekDays(weekStart)),
      isGoogleMasterSession(admin),
    ])

  if (person.error || !person.data) notFound()

  return (
    <PersonView
      person={person.data}
      modules={modules.data ?? []}
      assignments={assignments.data ?? []}
      managers={internManagerProfiles(managers.data ?? [], links.data ?? [], person.data.id)}
      weekStart={weekStart}
      today={today}
      savedDays={schedules.data ?? []}
      currentAdminId={admin.id}
      currentRole={admin.role}
      canChangeRoles={canChangeRoles}
    />
  )
}
