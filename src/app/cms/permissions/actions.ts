"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROLES, isElevated, isStaffRole, isSecurityRole } from "@/lib/roles";

const PENDING_STATUS = false;
const APPROVED_STATUS = true;

// ─── Types ────────────────────────────────────────────────────────────────────

export type StaffRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
  role_id: string | null;
  role_name: string | null;
};

export type RoleRecord = {
  id: string;
  name: string;
  description: string | null;
};

export type RolePermissionRecord = {
  id: string;
  role_id: string;
  page_path: string;
  can_access: boolean;
};

export type ContextData = {
  role: string;
  is_active: boolean;
  email: string;
  user_id: string;
};


// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - can be ignored if middleware refreshes sessions
          }
        },
      },
    }
  );
}

async function getRoleName(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>,
  roleId: string
): Promise<string> {
  if (!roleId) return "";
  const { data } = await supabase
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .maybeSingle();
  return data?.name ?? "";
}

async function getPendingRoleId(
  supabase: Awaited<ReturnType<typeof getSupabaseClient>>
): Promise<string> {
  const { data } = await supabase
    .from("roles")
    .select("id")
    .eq("name", ROLES.PENDING)
    .maybeSingle();
  return data?.id ?? "";
}

// ─── Context / Auth ───────────────────────────────────────────────────────────

export async function loadContext(): Promise<ContextData | null> {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const profileName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";

  const profileAvatar =
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    user.identities?.[0]?.identity_data?.picture ||
    null;

  const { data: existing, error: lookupError } = await supabase
    .from("system_user")
    .select("role_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  let roleId = existing?.role_id ?? "";
  let active = existing?.is_active ?? PENDING_STATUS;

  if (!existing && !lookupError) {
    const pendingRoleId = await getPendingRoleId(supabase);
    const { data: inserted, error: insertError } = await supabase
      .from("system_user")
      .insert({
        id: user.id,
        email: user.email,
        full_name: profileName,
        avatar_url: profileAvatar,
        role_id: pendingRoleId || null,
        is_active: PENDING_STATUS,
      })
      .select("role_id, is_active")
      .single();

    if (!insertError) {
      roleId = inserted?.role_id ?? roleId;
      active = inserted?.is_active ?? active;
    }
  }

  const roleName = await getRoleName(supabase, roleId);

  return {
    role: roleName,
    is_active: active,
    email: user.email ?? "",
    user_id: user.id,
  };
}

// ─── Staff Access (approval) ────────────────────────────────────────────────

export async function fetchStaffList(includeRejected = false): Promise<StaffRecord[]> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("system_user")
    .select("id, email, full_name, avatar_url, is_active, role_id, roles(name)")
    .order("is_active", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row: any) => {
      if (includeRejected) return true;
      return row.roles?.name !== "rejected";
    })
    .map((row: any) => ({
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_active: row.is_active,
      role_id: row.role_id,
      role_name: row.roles?.name ?? null,
    }));
}

export async function updateStaffStatus(
  id: string,
  value: boolean
): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error: updateError } = await supabase
    .from("system_user")
    .update({ is_active: value })
    .eq("id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export async function rejectStaff(id: string): Promise<void> {
  const supabase = await getSupabaseClient();

  let { data: rejectedRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "rejected")
    .maybeSingle();

  if (!rejectedRole) {
    const { data: newRole, error: createError } = await supabase
      .from("roles")
      .insert({ name: "rejected", description: "Rejected/soft-deleted users" })
      .select("id")
      .single();

    if (createError) throw new Error(createError.message);
    rejectedRole = newRole;
  }

  const { error } = await supabase
    .from("system_user")
    .update({ is_active: false, role_id: rejectedRole.id })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function restoreStaff(id: string): Promise<void> {
  const supabase = await getSupabaseClient();

  let pendingRoleId = await getPendingRoleId(supabase);

  if (!pendingRoleId) {
    const { data: newRole, error: createError } = await supabase
      .from("roles")
      .insert({ name: "pending", description: "Awaiting approval" })
      .select("id")
      .single();

    if (createError) throw new Error(createError.message);
    pendingRoleId = newRole.id;
  }

  const { error } = await supabase
    .from("system_user")
    .update({ is_active: false, role_id: pendingRoleId })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function assignUserRole(
  userId: string,
  roleId: string | null
): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("system_user")
    .update({ role_id: roleId })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export async function fetchRoles(): Promise<RoleRecord[]> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("roles")
    .select("id, name, description")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function createRole(
  name: string,
  description?: string
): Promise<string> {
  const supabase = await getSupabaseClient();

  // Prevent duplicate role names
  const { data: existing } = await supabase
    .from("roles")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (existing) {
    throw new Error("A role with that name already exists.");
  }

  const { data, error } = await supabase
    .from("roles")
    .insert({ name, description: description || null })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data.id;
}

export async function updateRole(
  id: string,
  name: string,
  description?: string
): Promise<void> {
  const supabase = await getSupabaseClient();

  // Prevent name collision with other roles
  const { data: existing } = await supabase
    .from("roles")
    .select("id")
    .eq("name", name)
    .neq("id", id)
    .maybeSingle();

  if (existing) {
    throw new Error("A role with that name already exists.");
  }

  const { error } = await supabase
    .from("roles")
    .update({ name, description: description || null })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteRole(id: string): Promise<void> {
  const supabase = await getSupabaseClient();

  // Re-assign users with this role to pending first
  const { error: updateError } = await supabase
    .from("system_user")
    .update({ role_id: null })
    .eq("role_id", id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error } = await supabase.from("roles").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export async function fetchRolePermissions(
  roleId: string
): Promise<RolePermissionRecord[]> {
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("role_permissions")
    .select("id, role_id, page_path, can_access")
    .eq("role_id", roleId);

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function setRolePermission(
  roleId: string,
  pagePath: string,
  canAccess: boolean
): Promise<void> {
  const supabase = await getSupabaseClient();

  // Upsert: try update first, then insert if not exists
  const { data: existing } = await supabase
    .from("role_permissions")
    .select("id")
    .eq("role_id", roleId)
    .eq("page_path", pagePath)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("role_permissions")
      .update({ can_access: canAccess })
      .eq("id", existing.id);

    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("role_permissions")
      .insert({ role_id: roleId, page_path: pagePath, can_access: canAccess });

    if (error) throw new Error(error.message);
  }
}

export async function deleteRolePermission(id: string): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("role_permissions")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

// ─── Access Check (used by middleware + client) ─────────────────────────────

export async function canAccessPage(
  userId: string,
  pagePath: string
): Promise<{ allowed: boolean; roleName: string }> {
  const supabase = await getSupabaseClient();

  // Admin always has access
  const { data: userData } = await supabase
    .from("system_user")
    .select("role_id, is_active")
    .eq("id", userId)
    .maybeSingle();

  if (!userData) {
    return { allowed: false, roleName: "" };
  }

  if (!userData.is_active) {
    return { allowed: false, roleName: "" };
  }

  let roleName = "";
  if (userData.role_id) {
    const { data: roleInfo } = await supabase
      .from("roles")
      .select("name")
      .eq("id", userData.role_id)
      .maybeSingle();
    roleName = roleInfo?.name ?? "";
  }

  if (isElevated(roleName)) {
    return { allowed: true, roleName };
  }

  // No role assigned — deny non-dashboard pages
  if (!userData.role_id) {
    return { allowed: pagePath === "/cms/dashboard", roleName };
  }

  // Check explicit role permission
  const { data: perm } = await supabase
    .from("role_permissions")
    .select("can_access")
    .eq("role_id", userData.role_id)
    .eq("page_path", pagePath)
    .maybeSingle();

  if (perm) {
    return { allowed: perm.can_access, roleName };
  }

  // Default: allow dashboard only if no explicit permission
  return { allowed: pagePath === "/cms/dashboard", roleName };
}
