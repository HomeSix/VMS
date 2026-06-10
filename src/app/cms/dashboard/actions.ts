"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

type AvailabilitySlot = {
  user_id: string;
  available_date: string;
  slot_time: string;
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

function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type AdminSnapshot = {
  totalAppointments: number;
  newBookings: number;
  totalStaff: number;
  pendingStaff: number;
  checkIns: number;
  pendingApprovals: number;
};

export type StaffSnapshot = {
  myAppointments: number;
  checkInsDone: number;
  pendingCheckIns: number;
  cancellations: number;
  walkIns: number;
};

export type AdminScheduleHealth = {
  approvedToday: number;
  rejectedToday: number;
  teachersAvailable: number;
  bookingsWithVehicles: number;
  peakHour: string;
  peakBookings: number;
};

export type StaffScheduleHealth = {
  myApproved: number;
  myRejected: number;
  nextAppointment: string;
  availableSlotsLeft: number;
};

export type SecuritySnapshot = {
  totalToday: number;
  checkedIn: number;
  pendingCheckIns: number;
  walkIns: number;
};

export type SecurityScheduleHealth = {
  approvedToday: number;
  rejectedToday: number;
  checkedOut: number;
};

export async function fetchSecuritySnapshot(): Promise<SecuritySnapshot> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const [
    { count: totalToday },
    { count: checkedIn },
    { count: pendingCheckIns },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("status", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_status", "approved")
      .or("status.is.null,status.eq.false"),
  ]);

  const { count: walkIns } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("visit_date", today)
    .eq("email", "security@example.com");

  return {
    totalToday: totalToday ?? 0,
    checkedIn: checkedIn ?? 0,
    pendingCheckIns: pendingCheckIns ?? 0,
    walkIns: walkIns ?? 0,
  };
}

export async function fetchSecurityScheduleHealth(): Promise<SecurityScheduleHealth> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const [
    { count: approvedToday },
    { count: rejectedToday },
    { count: checkedOut },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_status", "approved"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_status", "rejected"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("status", true),
  ]);

  return {
    approvedToday: approvedToday ?? 0,
    rejectedToday: rejectedToday ?? 0,
    checkedOut: checkedOut ?? 0,
  };
}

export async function saveAvailability(formData: {
  allDayAvailable: boolean;
  availabilityDate: string;
  slots: string[];
}) {
  const supabase = await getSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Please sign in again to continue." };
  }

  const { error: updateError } = await supabase
    .from("system_user")
    .update({ isAvailable: formData.allDayAvailable })
    .eq("id", user.id);

  if (updateError) {
    return { error: updateError.message };
  }

  const adminSupabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  const { error: deleteError } = await adminSupabase
    .from("teacher_availability")
    .delete()
    .eq("user_id", user.id)
    .eq("available_date", formData.availabilityDate);

  if (deleteError) {
    return { error: deleteError.message };
  }

  if (!formData.allDayAvailable && formData.slots.length > 0) {
    const payload: AvailabilitySlot[] = formData.slots.map((slot) => ({
      user_id: user.id,
      available_date: formData.availabilityDate,
      slot_time: slot,
    }));

    const { error: insertError } = await adminSupabase
      .from("teacher_availability")
      .insert(payload);

    if (insertError) {
      return { error: insertError.message };
    }
  }

  return { success: true };
}

export async function fetchAdminSnapshot(): Promise<AdminSnapshot> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const [
    { count: totalAppointments },
    { count: newBookings },
    { count: totalStaff },
    { count: checkIns },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .gte("created_at", today),
    supabase
      .from("system_user")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("status", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .or("book_status.is.null,book_status.eq.pending"),
  ]);

  const { data: pendingStaffData } = await supabase
    .from("system_user")
    .select("role_id, roles(name)")
    .eq("is_active", false);

  const pendingStaff = (pendingStaffData ?? []).filter(
    (u: any) => !u.roles || u.roles.name !== "admin"
  ).length;

  return {
    totalAppointments: totalAppointments ?? 0,
    newBookings: newBookings ?? 0,
    totalStaff: totalStaff ?? 0,
    pendingStaff,
    checkIns: checkIns ?? 0,
    pendingApprovals: pendingApprovals ?? 0,
  };
}

export async function fetchStaffSnapshot(): Promise<StaffSnapshot> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const { data: systemUser } = await supabase
    .from("system_user")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const staffName =
    String(systemUser?.full_name ?? "").trim() ||
    String(user.user_metadata?.full_name ?? "").trim() ||
    String(user.user_metadata?.name ?? "").trim() ||
    String(user.email?.split("@")[0] ?? "").trim();

  const [
    { count: myAppointments },
    { count: checkInsDone },
    { count: pendingCheckIns },
    { count: cancellations },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName)
      .eq("status", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName)
      .or("status.is.null,status.eq.false"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName)
      .eq("book_status", "rejected"),
  ]);

  return {
    myAppointments: myAppointments ?? 0,
    checkInsDone: checkInsDone ?? 0,
    pendingCheckIns: pendingCheckIns ?? 0,
    cancellations: cancellations ?? 0,
    walkIns: 0,
  };
}

export async function fetchAdminScheduleHealth(): Promise<AdminScheduleHealth> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const [
    { count: approvedToday },
    { count: rejectedToday },
    { count: bookingsWithVehicles },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_status", "approved"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_status", "rejected"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .not("plate_number", "is", null),
  ]);

  const { data: staffRole } = await supabase
    .from("roles")
    .select("id")
    .eq("name", "staff")
    .maybeSingle();

  let teachersAvailable = 0;
  if (staffRole) {
    const { count } = await supabase
      .from("system_user")
      .select("*", { count: "exact", head: true })
      .eq("role_id", staffRole.id)
      .eq("isAvailable", true);
    teachersAvailable = count ?? 0;
  }

  const { data: peakData } = await supabase
    .from("bookings")
    .select("start_time")
    .eq("visit_date", today)
    .not("start_time", "is", null);

  const peakMap = new Map<string, number>();
  for (const row of peakData ?? []) {
    const hour = String(row.start_time ?? "").slice(0, 5);
    if (hour.length === 5) {
      peakMap.set(hour, (peakMap.get(hour) ?? 0) + 1);
    }
  }

  let peakHour = "N/A";
  let peakBookings = 0;
  for (const [hour, count] of peakMap) {
    if (count > peakBookings) {
      peakHour = hour;
      peakBookings = count;
    }
  }

  return {
    approvedToday: approvedToday ?? 0,
    rejectedToday: rejectedToday ?? 0,
    teachersAvailable,
    bookingsWithVehicles: bookingsWithVehicles ?? 0,
    peakHour,
    peakBookings,
  };
}

export async function fetchStaffScheduleHealth(): Promise<StaffScheduleHealth> {
  const supabase = await getSupabaseClient();
  const today = getTodayKey();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const { data: systemUser } = await supabase
    .from("system_user")
    .select("full_name, isAvailable")
    .eq("id", user.id)
    .maybeSingle();

  const staffName =
    String(systemUser?.full_name ?? "").trim() ||
    String(user.user_metadata?.full_name ?? "").trim() ||
    String(user.user_metadata?.name ?? "").trim() ||
    String(user.email?.split("@")[0] ?? "").trim();

  const [
    { count: myApproved },
    { count: myRejected },
  ] = await Promise.all([
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName)
      .eq("book_status", "approved"),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("visit_date", today)
      .eq("book_teacher", staffName)
      .eq("book_status", "rejected"),
  ]);

  const { data: nextBooking } = await supabase
    .from("bookings")
    .select("start_time")
    .eq("visit_date", today)
    .eq("book_teacher", staffName)
    .eq("book_status", "approved")
    .order("start_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  const nextAppointment = nextBooking?.start_time
    ? String(nextBooking.start_time).slice(0, 5)
    : "None";

  const { count: totalSlots } = await supabase
    .from("teacher_availability")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("available_date", today);

  const { count: usedSlots } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("visit_date", today)
    .eq("book_teacher", staffName)
    .eq("book_status", "approved");

  const isAllDay = systemUser?.isAvailable === true;
  const totalSlotsAvailable = isAllDay ? 17 : (totalSlots ?? 0);
  const availableSlotsLeft = Math.max(0, totalSlotsAvailable - (usedSlots ?? 0));

  return {
    myApproved: myApproved ?? 0,
    myRejected: myRejected ?? 0,
    nextAppointment,
    availableSlotsLeft,
  };
}

function getDateRange(daysBack: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = daysBack; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(getTodayKeyFromDate(d));
  }
  return dates;
}

function getTodayKeyFromDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type TrendSeries = {
  label: string;
  values: number[];
  change: string;
  caption: string;
  accent: string;
};

export async function fetchAdminTrends(): Promise<TrendSeries[]> {
  const supabase = await getSupabaseClient();
  const currentWeek = getDateRange(6);
  const rangeStart = getDateRange(13)[0];

  const { data: rows } = await supabase
    .from("bookings")
    .select("visit_date, book_status")
    .gte("visit_date", rangeStart)
    .lte("visit_date", currentWeek[6]);

  const total = new Map<string, number>();
  const approved = new Map<string, number>();
  const cancelled = new Map<string, number>();

  for (const row of rows ?? []) {
    const date = String(row.visit_date ?? "");
    if (!date) continue;
    total.set(date, (total.get(date) ?? 0) + 1);
    if (row.book_status === "approved") approved.set(date, (approved.get(date) ?? 0) + 1);
    if (row.book_status === "rejected") cancelled.set(date, (cancelled.get(date) ?? 0) + 1);
  }

  const sum = (map: Map<string, number>, dates: string[]) =>
    dates.reduce((s, d) => s + (map.get(d) ?? 0), 0);

  const vals = (map: Map<string, number>, dates: string[]) =>
    dates.map(d => map.get(d) ?? 0);

  const computeChange = (cur: number, prev: number): string => {
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const diff = ((cur - prev) / prev) * 100;
    return `${diff >= 0 ? "+" : ""}${Math.round(diff)}% WoW`;
  };

  const prevWeek = getDateRange(13).slice(0, 7);

  const totalCur = sum(total, currentWeek);
  const totalPrev = sum(total, prevWeek);
  const approvedCur = sum(approved, currentWeek);
  const approvedPrev = sum(approved, prevWeek);
  const cancelledCur = sum(cancelled, currentWeek);
  const cancelledPrev = sum(cancelled, prevWeek);

  return [
    {
      label: "Bookings",
      values: vals(total, currentWeek),
      change: computeChange(totalCur, totalPrev),
      caption: "Total bookings last 7 days",
      accent: "#10b981",
    },
    {
      label: "Approvals",
      values: vals(approved, currentWeek),
      change: computeChange(approvedCur, approvedPrev),
      caption: "Approved bookings",
      accent: "#6366f1",
    },
    {
      label: "Cancellations",
      values: vals(cancelled, currentWeek),
      change: computeChange(cancelledCur, cancelledPrev),
      caption: "Rejected bookings",
      accent: "#f43f5e",
    },
  ];
}

export async function fetchStaffTrends(): Promise<TrendSeries[]> {
  const supabase = await getSupabaseClient();
  const currentWeek = getDateRange(6);
  const rangeStart = getDateRange(13)[0];

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Please sign in again to continue.");
  }

  const { data: systemUser } = await supabase
    .from("system_user")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const staffName =
    String(systemUser?.full_name ?? "").trim() ||
    String(user.user_metadata?.full_name ?? "").trim() ||
    String(user.user_metadata?.name ?? "").trim() ||
    String(user.email?.split("@")[0] ?? "").trim();

  const { data: rows } = await supabase
    .from("bookings")
    .select("visit_date, book_status, status")
    .eq("book_teacher", staffName)
    .gte("visit_date", rangeStart)
    .lte("visit_date", currentWeek[6]);

  const total = new Map<string, number>();
  const approved = new Map<string, number>();
  const checkins = new Map<string, number>();

  for (const row of rows ?? []) {
    const date = String(row.visit_date ?? "");
    if (!date) continue;
    total.set(date, (total.get(date) ?? 0) + 1);
    if (row.book_status === "approved") approved.set(date, (approved.get(date) ?? 0) + 1);
    if (row.status === true) checkins.set(date, (checkins.get(date) ?? 0) + 1);
  }

  const sum = (map: Map<string, number>, dates: string[]) =>
    dates.reduce((s, d) => s + (map.get(d) ?? 0), 0);

  const vals = (map: Map<string, number>, dates: string[]) =>
    dates.map(d => map.get(d) ?? 0);

  const computeChange = (cur: number, prev: number): string => {
    if (prev === 0) return cur > 0 ? "+100%" : "0%";
    const diff = ((cur - prev) / prev) * 100;
    return `${diff >= 0 ? "+" : ""}${Math.round(diff)}% WoW`;
  };

  const prevWeek = getDateRange(13).slice(0, 7);

  const totalCur = sum(total, currentWeek);
  const totalPrev = sum(total, prevWeek);
  const approvedCur = sum(approved, currentWeek);
  const approvedPrev = sum(approved, prevWeek);
  const checkinsCur = sum(checkins, currentWeek);
  const checkinsPrev = sum(checkins, prevWeek);

  return [
    {
      label: "My bookings",
      values: vals(total, currentWeek),
      change: computeChange(totalCur, totalPrev),
      caption: "Your appointments last 7 days",
      accent: "#10b981",
    },
    {
      label: "Check-ins",
      values: vals(checkins, currentWeek),
      change: computeChange(checkinsCur, checkinsPrev),
      caption: "Visitors who checked in",
      accent: "#6366f1",
    },
    {
      label: "Approvals",
      values: vals(approved, currentWeek),
      change: computeChange(approvedCur, approvedPrev),
      caption: "Approved bookings",
      accent: "#f59e0b",
    },
  ];
}
