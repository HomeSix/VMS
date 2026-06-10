"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { loadContext } from "../permissions/actions";
import { sendEmail } from "@/lib/mail";

const ADMIN_ROLE = "admin";
const SECURITY_ROLE = "security";
const STAFF_ROLE = "staff";
const WALK_IN_EMAIL = "security@example.com";

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

async function assertApprovalsAccess() {
  const context = await loadContext();
  if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE && context.role !== STAFF_ROLE)) {
    throw new Error("You are not authorized to access booking approvals.");
  }
  return context;
}

async function getStaffName(supabase: Awaited<ReturnType<typeof getSupabaseClient>>, userId: string) {
  const { data } = await supabase
    .from("system_user")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  return data?.full_name ?? "";
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
      .or("book_status.is.null,book_status.eq.pending,book_status.eq.approved,book_status.eq.rejected");
  } else if (context.role === STAFF_ROLE) {
    const staffName = await getStaffName(supabase, context.user_id);
    if (!staffName) {
      return [];
    }
    query = query
      .eq("book_teacher", staffName)
      .or("book_status.is.null,book_status.eq.pending");
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

  // Verify the user is authorized to approve this booking
  if (context.role === STAFF_ROLE) {
    const staffName = await getStaffName(supabase, context.user_id);
    if (!staffName) {
      throw new Error("Staff name not found.");
    }
    const { data: booking } = await supabase
      .from("bookings")
      .select("book_teacher")
      .eq("id", id)
      .maybeSingle();
    if (!booking || booking.book_teacher !== staffName) {
      throw new Error("You can only approve bookings assigned to you.");
    }
  } else if (context.role === SECURITY_ROLE) {
    const { data: booking } = await supabase
      .from("bookings")
      .select("email")
      .eq("id", id)
      .maybeSingle();
    if (!booking || booking.email !== context.email) {
      throw new Error("You can only approve your own assigned bookings.");
    }
  }

  // Use admin client to bypass RLS (users may not have UPDATE permission)
  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { error } = await adminSupabase
    .from("bookings")
    .update({ book_status: status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  try {
    const { data: booking } = await supabase
      .from("bookings")
      .select("full_name, email, visit_date, start_time, end_time, book_teacher, dial_code, phone_number")
      .eq("id", id)
      .maybeSingle();

    if (booking?.email && booking.email !== WALK_IN_EMAIL) {
      const statusLabel = status === "approved" ? "Approved" : "Rejected";
      await sendEmail({
        to: booking.email,
        subject: `Your Visit Booking has been ${statusLabel}`,
        html: `
          <h2>Booking ${statusLabel}</h2>
          <p>Dear ${booking.full_name},</p>
          <p>Your visit booking has been <strong>${statusLabel.toUpperCase()}</strong>.</p>
          <table>
            <tr><td><strong>Status:</strong></td><td>${statusLabel}</td></tr>
            <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
            ${booking.book_teacher ? `<tr><td><strong>Teacher:</strong></td><td>${booking.book_teacher}</td></tr>` : ""}
          </table>
        `,
      })
    }
  } catch (emailErr) {
    console.error("Failed to send approval email:", emailErr)
  }
}

export async function updateBookingVisitStatus(
  id: number,
  value: boolean
): Promise<void> {
  await assertApprovalsAccess();

  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { error } = await adminSupabase
    .from("bookings")
    .update({ status: value })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}
