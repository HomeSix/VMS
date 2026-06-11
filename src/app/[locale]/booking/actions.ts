"use server"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { sendEmail } from "@/lib/mail"

export interface CreateBookingInput {
  full_name: string
  dial_code: string
  phone_number: string
  email: string | null
  visit_reason: string
  visit_date: string
  start_time: string
  end_time: string
  plate_number: string | null
  book_teacher: string | null
}

async function getSupabaseClient() {
  const cookieStore = await cookies()
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
  )
}

export async function createBooking(input: CreateBookingInput) {
  const supabase = await getSupabaseClient()

  const { error } = await supabase.from("bookings").insert({
    full_name: input.full_name,
    dial_code: input.dial_code,
    phone_number: input.phone_number,
    email: input.email || null,
    visit_reason: input.visit_reason,
    visit_date: input.visit_date,
    start_time: input.start_time,
    end_time: input.end_time,
    plate_number: input.plate_number || null,
    book_teacher: input.book_teacher || null,
    book_status: "pending",
  })

  if (error) {
    return { success: false, error: error.message }
  }

  // Notify all admins and superadmins about the new booking
  try {
    const { data: roleData } = await supabase
      .from("roles")
      .select("id, name")
      .in("name", ["admin", "superadmin"])

    if (roleData && roleData.length > 0) {
      const roleIds = roleData.map((r: any) => r.id)

      const { data: adminUsers } = await supabase
        .from("system_user")
        .select("email")
        .in("role_id", roleIds)
        .not("email", "is", null)

      if (adminUsers && adminUsers.length > 0) {
        const adminEmails = adminUsers
          .map((u: any) => u.email)
          .filter(Boolean)

        if (adminEmails.length > 0) {
          await sendEmail({
            to: adminEmails,
            subject: `New Booking from ${input.full_name}`,
            html: `
              <h2>New Visit Booking Notification</h2>
              <p>A visitor has booked an appointment with <strong>${input.book_teacher || "a teacher"}</strong>.</p>
              <table>
                <tr><td><strong>Name:</strong></td><td>${input.full_name}</td></tr>
                <tr><td><strong>Phone:</strong></td><td>${input.dial_code} ${input.phone_number}</td></tr>
                ${input.email ? `<tr><td><strong>Email:</strong></td><td>${input.email}</td></tr>` : ""}
                <tr><td><strong>Teacher:</strong></td><td>${input.book_teacher || "-"}</td></tr>
                <tr><td><strong>Date:</strong></td><td>${input.visit_date}</td></tr>
                <tr><td><strong>Time:</strong></td><td>${input.start_time} - ${input.end_time}</td></tr>
                <tr><td><strong>Reason:</strong></td><td>${input.visit_reason}</td></tr>
                ${input.plate_number ? `<tr><td><strong>Plate Number:</strong></td><td>${input.plate_number}</td></tr>` : ""}
              </table>
              <p>Please review and approve or reject this booking in the CMS.</p>
            `,
          })
        }
      }
    }
  } catch {
    // Email notification is non-critical; booking is already created
  }

  return { success: true, error: null }
}
