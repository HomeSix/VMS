"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadContext } from "../permissions/actions";

const ADMIN_ROLE = "admin";

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

async function assertAdmin() {
  const context = await loadContext();
  if (!context || context.role !== ADMIN_ROLE) {
    throw new Error("You are not authorized to access booking approvals.");
  }
}

export async function fetchPendingBookings(): Promise<BookingApprovalRecord[]> {
  await assertAdmin();
  const supabase = await getSupabaseClient();

  const { data, error } = await supabase
    .from("bookings")
    .select(
      "id, full_name, phone_number, email, visit_reason, visit_date, start_time, end_time, plate_number, created_at, dial_code, book_teacher, book_status"
    )
    .or("book_status.is.null,book_status.eq.pending")
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
  await assertAdmin();
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("bookings")
    .update({ book_status: status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
