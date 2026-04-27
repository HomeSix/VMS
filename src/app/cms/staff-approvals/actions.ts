"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const PENDING_STATUS = false;
const APPROVED_STATUS = true;

export type StaffRecord = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_active: boolean | null;
};

export type ContextData = {
  role: string;
  is_active: boolean;
  email: string;
  user_id: string;
};

async function getSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
      },
    }
  );
}

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
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  let role = existing?.role ?? "";
  let active = existing?.is_active ?? PENDING_STATUS;

  if (!existing && !lookupError) {
    const { data: inserted, error: insertError } = await supabase
      .from("system_user")
      .insert({
        id: user.id,
        email: user.email,
        full_name: profileName,
        avatar_url: profileAvatar,
        is_active: PENDING_STATUS,
      })
      .select("role, is_active")
      .single();

    if (!insertError) {
      role = inserted?.role ?? role;
      active = inserted?.is_active ?? active;
    }
  }

  return {
    role,
    is_active: active,
    email: user.email ?? "",
    user_id: user.id,
  };
}

export async function fetchStaffList(): Promise<StaffRecord[]> {
  const supabase = await getSupabaseClient();

  const { data } = await supabase
    .from("system_user")
    .select("id, email, full_name, avatar_url, is_active")
    .in("is_active", [PENDING_STATUS, APPROVED_STATUS])
    .order("is_active", { ascending: true });

  return data ?? [];
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
