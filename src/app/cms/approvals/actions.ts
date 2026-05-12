"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadContext } from "../permissions/actions";

const ADMIN_ROLE = "admin";
const SECURITY_ROLE = "security";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type BookingApprovalRecord = {
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
  book_status: ApprovalStatus | null;
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

async function assertApprovalsAccess() {
  const context = await loadContext();
  if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE)) {
    throw new Error("You are not authorized to access booking approvals.");
  }
  return context;
}

export async function fetchApprovalBookings(): Promise<BookingApprovalRecord[]> {
  const context = await assertApprovalsAccess();
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("bookings")
    .select(
      "id, full_name, phone_number, email, visit_reason, visit_date, start_time, end_time, plate_number, created_at, dial_code, book_teacher, status, book_status"
    );

  if (context.role === ADMIN_ROLE) {
    query = query.or("book_status.is.null,book_status.eq.pending");
  } else if (context.role === SECURITY_ROLE) {
    query = query
      .eq("email", context.email)
      .in("book_status", ["approved", "rejected"]);
  }

  const { data, error } = await query
    .order("visit_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateBookingApproval(
  id: number,
  status: Exclude<ApprovalStatus, "pending">
): Promise<void> {
  const context = await assertApprovalsAccess();
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("bookings")
    .update({ book_status: status })
    .eq("id", id);

  if (context.role === SECURITY_ROLE) {
    query = query.eq("email", context.email);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateBookingVisitStatus(
  id: number,
  value: boolean
): Promise<void> {
  const context = await assertApprovalsAccess();
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("bookings")
    .update({ status: value })
    .eq("id", id);

  if (context.role === SECURITY_ROLE) {
    query = query.eq("email", context.email);
  }

  const { error } = await query;

  if (error) {
    throw new Error(error.message);
  }
}
