"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type SupabaseClient = Awaited<ReturnType<typeof getSupabaseClient>>;

export type HistoryFilters = {
  fromDate?: string;
  toDate?: string;
  walkInOnly?: boolean;
};

export type HistoryContext = {
  role: string;
  userId: string;
  staffName: string;
  email: string;
};

export type BookingApprovalStatus = "pending" | "approved" | "rejected";

const WALK_IN_EMAIL = "security@example.com";

export type BookingRecord = {
  id: number | null;
  full_name: string | null;
  phone_number: string | null;
  email: string | null;
  visit_reason: string | null;
  visit_date: string | null;
  start_time: string | null;
  end_time: string | null;
  plate_number: string | null;
  created_at: string | null;
  dial_code: string | null;
  book_teacher: string | null;
  status: boolean | null;
  book_status: BookingApprovalStatus | null;
};

export async function updateBookingStatus(
  id: number,
  value: boolean
): Promise<void> {
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status: value })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

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

async function getRoleName(supabase: SupabaseClient, roleId: string) {
  if (!roleId) return "";
  const { data } = await supabase
    .from("roles")
    .select("name")
    .eq("id", roleId)
    .maybeSingle();
  return data?.name ?? "";
}

function normalizeName(value?: string | null) {
  return String(value ?? "").trim();
}

export async function fetchHistoryBookings(
  filters: HistoryFilters = {}
): Promise<{ context: HistoryContext; bookings: BookingRecord[] }> {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const { data: systemUser, error: systemUserError } = await supabase
    .from("system_user")
    .select("role_id, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (systemUserError) {
    throw new Error(systemUserError.message);
  }

  const roleName = systemUser?.role_id
    ? await getRoleName(supabase, systemUser.role_id)
    : "";

  const staffName =
    normalizeName(systemUser?.full_name) ||
    normalizeName(user.user_metadata?.full_name) ||
    normalizeName(user.user_metadata?.name) ||
    normalizeName(user.email?.split("@")[0]);

  let query = supabase
    .from("bookings")
    .select(
      "id, full_name, phone_number, email, visit_reason, visit_date, start_time, end_time, plate_number, created_at, dial_code, book_teacher, status, book_status"
    );

  if (roleName === "staff") {
    if (!staffName) {
      return {
        context: {
          role: roleName,
          userId: user.id,
          staffName: "",
          email: user.email ?? "",
        },
        bookings: [],
      };
    }
    query = query.eq("book_teacher", staffName);
  }

  if (filters.fromDate) {
    query = query.gte("visit_date", filters.fromDate);
  }

  if (filters.toDate) {
    query = query.lte("visit_date", filters.toDate);
  }

  if (filters.walkInOnly) {
    query = query.eq("email", WALK_IN_EMAIL);
  }

  query = query.in("book_status", ["approved", "rejected"]);

  const { data, error } = await query
    .order("visit_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return {
    context: {
      role: roleName,
      userId: user.id,
      staffName,
      email: user.email ?? "",
    },
    bookings: data ?? [],
  };
}
