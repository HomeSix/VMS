"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ROLES, isElevated } from "@/lib/roles";
import { loadContext, canAccessPage } from "../permissions/actions";
import { sendEmail } from "@/lib/mail";

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

async function assertViewAccess() {
  const context = await loadContext();
  if (!context) {
    throw new Error("Please sign in again to continue.");
  }
  const { allowed } = await canAccessPage(context.user_id, "/cms/approvals");
  if (!allowed) {
    throw new Error("You are not authorized to access booking approvals.");
  }
  return context;
}

async function assertAdminAccess() {
  const context = await assertViewAccess();
  if (!isElevated(context.role)) {
    throw new Error("Only admins can perform this action.");
  }
  return context;
}

export async function fetchApprovalBookings(date?: string, walkInOnly?: boolean): Promise<BookingApprovalRecord[]> {
  const context = await assertViewAccess();
  const supabase = await getSupabaseClient();

  let query = supabase
    .from("bookings")
    .select(
      "id, full_name, phone_number, email, visit_reason, visit_date, start_time, end_time, plate_number, created_at, dial_code, book_teacher, status, book_status"
    )
    .or("book_status.is.null,book_status.eq.pending");

  // Staff can only see their own bookings
  if (context.role === ROLES.STAFF) {
    const { data: userData } = await supabase
      .from("system_user")
      .select("full_name")
      .eq("id", context.user_id)
      .maybeSingle();

    const staffName = userData?.full_name;
    if (!staffName) {
      return [];
    }
    query = query.eq("book_teacher", staffName);
  }

  if (date) {
    query = query.eq("visit_date", date);
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
  await assertAdminAccess();
  const supabase = await getSupabaseClient();

  const { error } = await supabase
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

    if (!booking) return;

    const teacherName = booking.book_teacher;

    if (status === "approved") {
      // Notify visitor
      if (booking.email && booking.email !== WALK_IN_EMAIL) {
        await sendEmail({
          to: booking.email,
          subject: "Your Visit Booking has been Approved",
          html: `
            <h2>Booking Approved</h2>
            <p>Dear ${booking.full_name},</p>
            <p>Your visit booking has been <strong>APPROVED</strong>.</p>
            <p>Please visit the <strong>school administration lobby/room</strong> to meet with ${teacherName || "the teacher"} at the scheduled time.</p>
            <table>
              <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
              <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
              ${teacherName ? `<tr><td><strong>Teacher:</strong></td><td>${teacherName}</td></tr>` : ""}
            </table>
            <p>Thank you.</p>
          `,
        })
      }

      // Notify teacher
      if (teacherName) {
        const { data: teacher } = await supabase
          .from("system_user")
          .select("email")
          .eq("full_name", teacherName)
          .maybeSingle();

        if (teacher?.email) {
          await sendEmail({
            to: teacher.email,
            subject: "Appointment Approved – Visitor Scheduled to Meet You",
            html: `
              <h2>Appointment Approved</h2>
              <p>Dear ${teacherName},</p>
              <p>A visitor has an approved appointment to meet with you.</p>
              <p>Please <strong>receive them at the school administration lobby/room</strong> at the scheduled time.</p>
              <table>
                <tr><td><strong>Visitor:</strong></td><td>${booking.full_name}</td></tr>
                <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
                <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
                ${booking.dial_code && booking.phone_number ? `<tr><td><strong>Phone:</strong></td><td>${booking.dial_code} ${booking.phone_number}</td></tr>` : ""}
              </table>
            `,
          })
        }
      }
    } else if (status === "rejected") {
      // Notify visitor about rejection
      if (booking.email && booking.email !== WALK_IN_EMAIL) {
        await sendEmail({
          to: booking.email,
          subject: "Your Visit Booking has been Rejected",
          html: `
            <h2>Booking Rejected</h2>
            <p>Dear ${booking.full_name},</p>
            <p>Your visit booking has been <strong>REJECTED</strong>.</p>
            ${teacherName ? `<p>You had requested to meet with <strong>${teacherName}</strong>.</p>` : ""}
            <table>
              <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
              <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
            </table>
            <p>Please book another appointment at your convenience.</p>
            <p>We apologise for any inconvenience.</p>
          `,
        })
      }
    }
  } catch (emailErr) {
    console.error("Failed to send approval email:", emailErr)
  }
}

export async function updateBookingVisitStatus(
  id: number,
  value: boolean
): Promise<void> {
  await assertAdminAccess();
  const supabase = await getSupabaseClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status: value })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function cancelBookingApproval(
  id: number
): Promise<void> {
  const context = await assertAdminAccess();
  const supabase = await getSupabaseClient();

  const { data: booking, error: updateError } = await supabase
    .from("bookings")
    .update({ book_status: "pending" })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!booking) {
    throw new Error("Booking not found or you don't have permission to cancel it.");
  }

  try {
    const adminEmail = context.email;

    if (booking.email && booking.email !== WALK_IN_EMAIL) {
      await sendEmail({
        to: booking.email,
        subject: "Your Booking Has Been Cancelled",
        html: `
          <h2>Booking Cancelled</h2>
          <p>Dear ${booking.full_name},</p>
          <p>Your visit booking for <strong>${booking.visit_date}</strong> at <strong>${booking.start_time}</strong> has been cancelled.</p>
          <p>Please try booking again or contact the school for more information.</p>
          <table>
            <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
            ${booking.book_teacher ? `<tr><td><strong>Teacher:</strong></td><td>${booking.book_teacher}</td></tr>` : ""}
          </table>
          <p>We apologise for any inconvenience.</p>
        `,
      });
    }

    if (adminEmail) {
      const visitorPhone = booking.dial_code && booking.phone_number ? `${booking.dial_code} ${booking.phone_number}` : "No phone number";
      await sendEmail({
        to: adminEmail,
        subject: "Booking Cancellation – Please Contact Visitor",
        html: `
          <h2>Booking Cancelled – Action Required</h2>
          <p>You cancelled a booking for <strong>${booking.full_name}</strong>.</p>
          <p>Please contact the visitor to inform them about the cancellation:</p>
          <table>
            <tr><td><strong>Visitor:</strong></td><td>${booking.full_name}</td></tr>
            <tr><td><strong>Phone:</strong></td><td>${visitorPhone}</td></tr>
            <tr><td><strong>Email:</strong></td><td>${booking.email || "N/A"}</td></tr>
            <tr><td><strong>Date:</strong></td><td>${booking.visit_date}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${booking.start_time} - ${booking.end_time}</td></tr>
          </table>
        `,
      });
    }
  } catch (emailErr) {
    console.error("Failed to send cancellation email:", emailErr);
  }
}
