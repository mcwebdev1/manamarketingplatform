"use server"

import { revalidatePath } from "next/cache"
import { managedInternError, requireAdmin, requireProfile } from "@/lib/auth"
import { isStaff } from "@/lib/types"
import { createClient } from "@/lib/supabase/server"
import type { Enums } from "@/lib/database.types"

export async function saveInternAssignments(
  internId: string,
  moduleIds: string[]
) {
  const admin = await requireAdmin()
  // RLS enforces this too: only interns the caller manages.
  const scopeError = await managedInternError(admin, internId)
  if (scopeError) return { error: scopeError }

  const supabase = await createClient()

  const { data: existing, error: existingError } = await supabase
    .from("assignments")
    .select("id, module_id")
    .eq("intern_id", internId)

  if (existingError) return { error: existingError.message }

  const currentIds = new Set((existing ?? []).map((row) => row.module_id))
  const nextIds = new Set(moduleIds)

  const toDelete = (existing ?? [])
    .filter((row) => !nextIds.has(row.module_id))
    .map((row) => row.id)
  const toInsert = moduleIds.filter((id) => !currentIds.has(id))

  if (toDelete.length) {
    const { error } = await supabase.from("assignments").delete().in("id", toDelete)
    if (error) return { error: error.message }
  }

  if (toInsert.length) {
    const { error } = await supabase.from("assignments").insert(
      toInsert.map((moduleId) => ({
        intern_id: internId,
        module_id: moduleId,
        assigned_by: admin.id,
      }))
    )
    if (error) return { error: error.message }
  }

  revalidatePath("/onboarding")
  revalidatePath("/team")
  revalidatePath(`/team/${internId}`)
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath("/admin/assign")
  revalidatePath(`/admin/people/${internId}`)
  return { success: true }
}

export async function saveAssignmentsForInterns(
  internIds: string[],
  moduleIds: string[]
) {
  for (const internId of internIds) {
    const result = await saveInternAssignments(internId, moduleIds)
    if (result.error) return result
  }
  return { success: true }
}

export async function updateAssignmentStatus(
  assignmentId: string,
  status: Enums<"assignment_status">
) {
  const profile = await requireProfile()
  const supabase = await createClient()

  if (isStaff(profile.role)) {
    const { data: assignment } = await supabase
      .from("assignments")
      .select("intern_id")
      .eq("id", assignmentId)
      .maybeSingle()
    if (!assignment) return { error: "That module was not found." }
    const scopeError = await managedInternError(profile, assignment.intern_id)
    if (scopeError) return { error: scopeError }
  }

  const patch = {
    status,
    started_at:
      status === "in_progress" || status === "completed"
        ? new Date().toISOString()
        : null,
    completed_at: status === "completed" ? new Date().toISOString() : null,
  }

  if (status === "in_progress") {
    const { data: current } = await supabase
      .from("assignments")
      .select("started_at")
      .eq("id", assignmentId)
      .maybeSingle()

    patch.started_at = current?.started_at ?? new Date().toISOString()
    patch.completed_at = null
  }

  if (status === "not_started") {
    patch.started_at = null
    patch.completed_at = null
  }

  const query = supabase.from("assignments").update(patch).eq("id", assignmentId)
  const scoped = isStaff(profile.role) ? query : query.eq("intern_id", profile.id)

  const { error } = await scoped
  if (error) return { error: error.message }

  revalidatePath("/onboarding")
  revalidatePath("/team")
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath("/admin/assign")
  return { success: true }
}

type SavedAssignment = {
  status: Enums<"assignment_status">
  started_at: string | null
  completed_at: string | null
  assigned_by: string | null
}

function revalidateAssignment(personId: string) {
  revalidatePath("/onboarding")
  revalidatePath("/team")
  revalidatePath(`/team/${personId}`)
  revalidatePath("/admin")
  revalidatePath("/admin/people")
  revalidatePath(`/admin/people/${personId}`)
}

// Adds modules that are not already assigned. Does not remove any.
export async function sendModules(personIds: string[], moduleIds: string[]) {
  const admin = await requireAdmin()
  if (moduleIds.length === 0) return { error: "Choose a module" }
  const supabase = await createClient()

  for (const personId of personIds) {
    const scopeError = await managedInternError(admin, personId)
    if (scopeError) return { error: scopeError }

    const { data: existing, error: existingError } = await supabase
      .from("assignments")
      .select("module_id")
      .eq("intern_id", personId)
    if (existingError) return { error: existingError.message }

    const current = new Set((existing ?? []).map((row) => row.module_id))
    const toInsert = moduleIds.filter((id) => !current.has(id))
    if (toInsert.length === 0) continue

    const { error } = await supabase.from("assignments").insert(
      toInsert.map((moduleId) => ({
        intern_id: personId,
        module_id: moduleId,
        assigned_by: admin.id,
      }))
    )
    if (error) return { error: error.message }
    revalidateAssignment(personId)
  }

  return { success: true }
}

export async function setPersonModule(personId: string, moduleId: string, assigned: boolean) {
  const admin = await requireAdmin()
  const scopeError = await managedInternError(admin, personId)
  if (scopeError) return { error: scopeError }
  const supabase = await createClient()

  if (!assigned) {
    const { data, error } = await supabase
      .from("assignments")
      .delete()
      .eq("intern_id", personId)
      .eq("module_id", moduleId)
      .select("status, started_at, completed_at, assigned_by")
      .maybeSingle()
    if (error) return { error: error.message }
    revalidateAssignment(personId)
    return { success: true as const, removed: data as SavedAssignment | null }
  }

  const { error } = await supabase.from("assignments").insert({
    intern_id: personId,
    module_id: moduleId,
    assigned_by: admin.id,
  })
  if (error && error.code !== "23505") return { error: error.message }
  revalidateAssignment(personId)
  return { success: true as const, removed: null }
}

export async function restorePersonModule(
  personId: string,
  moduleId: string,
  previous: SavedAssignment | null
) {
  const admin = await requireAdmin()
  const scopeError = await managedInternError(admin, personId)
  if (scopeError) return { error: scopeError }
  const supabase = await createClient()

  if (!previous) {
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("intern_id", personId)
      .eq("module_id", moduleId)
    if (error) return { error: error.message }
    revalidateAssignment(personId)
    return { success: true }
  }

  const { error } = await supabase.from("assignments").upsert(
    {
      intern_id: personId,
      module_id: moduleId,
      assigned_by: previous.assigned_by ?? admin.id,
      status: previous.status,
      started_at: previous.started_at,
      completed_at: previous.completed_at,
    },
    { onConflict: "intern_id,module_id" }
  )
  if (error) return { error: error.message }
  revalidateAssignment(personId)
  return { success: true }
}
