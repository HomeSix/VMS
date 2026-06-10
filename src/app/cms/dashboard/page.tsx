"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadContext, type ContextData } from "../permissions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/client";
import {
  fetchAdminSnapshot,
  fetchStaffSnapshot,
  fetchAdminScheduleHealth,
  fetchStaffScheduleHealth,
  fetchAdminTrends,
  fetchStaffTrends,
  saveAvailability,
  type AdminSnapshot,
  type StaffSnapshot,
  type AdminScheduleHealth,
  type StaffScheduleHealth,
  type TrendSeries,
} from "./actions";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const ADMIN_ROLE = "admin";
const STAFF_ROLE = "staff";
const APPROVED_STATUS = true;

const OPEN_START = 8 * 60;
const OPEN_END = 16 * 60 + 30;
const SLOT_STEP = 30;

const toTime = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = Math.floor(minutes % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${mins}`;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const TIME_SLOTS = Array.from(
  { length: Math.ceil((OPEN_END - OPEN_START) / SLOT_STEP) },
  (_, index) => toTime(OPEN_START + index * SLOT_STEP)
);

type RecentBooking = {
  id: number;
  full_name: string;
  visit_reason: string | null;
  visit_date: string;
  start_time: string;
  end_time: string;
  created_at: string;
  book_teacher: string;
  status: boolean | null;
};

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const [availabilityDate, setAvailabilityDate] = useState(() =>
    toDateKey(new Date())
  );
  const [allDayAvailable, setAllDayAvailable] = useState(true);
  const [availabilitySlots, setAvailabilitySlots] = useState<string[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null
  );
  const [availabilitySuccess, setAvailabilitySuccess] = useState<string | null>(
    null
  );
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([]);
  const [recentLoading, setRecentLoading] = useState(false);
  const [adminSnapshot, setAdminSnapshot] = useState<AdminSnapshot | null>(null);
  const [staffSnapshot, setStaffSnapshot] = useState<StaffSnapshot | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [adminHealth, setAdminHealth] = useState<AdminScheduleHealth | null>(null);
  const [staffHealth, setStaffHealth] = useState<StaffScheduleHealth | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [trendSeries, setTrendSeries] = useState<TrendSeries[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);

  const loadContextData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadContext();
      setContext(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load access status"
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadContextData();
  }, [loadContextData]);

  const handleCheckStatus = useCallback(async () => {
    setError(null);
    try {
      const updatedContext = await loadContext();
      setContext(updatedContext);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to check access status"
      );
    }
  }, []);

  const loadAvailability = useCallback(async () => {
    if (!context || context.role === ADMIN_ROLE) return;
    setAvailabilityLoading(true);
    setAvailabilityError(null);
    setAvailabilitySuccess(null);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAvailabilityError("Unable to load your profile.");
      setAvailabilityLoading(false);
      return;
    }

    const { data: userRecord, error: userRecordError } = await supabase
      .from("system_user")
      .select("isAvailable")
      .eq("id", user.id)
      .maybeSingle();

    if (userRecordError) {
      setAvailabilityError(userRecordError.message);
    }

    const allDay = Boolean(
      userRecord?.isAvailable ?? true
    );
    setAllDayAvailable(allDay);

    const { data: slotRows } = await supabase
      .from("teacher_availability")
      .select("slot_time")
      .eq("user_id", user.id)
      .eq("available_date", availabilityDate);

    const slots = (slotRows ?? [])
      .map((row: any) => String(row.slot_time ?? "").slice(0, 5))
      .filter((slot) => slot.length === 5);

    setAvailabilitySlots(slots);
    setAvailabilityLoading(false);
  }, [availabilityDate, context, supabase]);

  useEffect(() => {
    if (!context || context.role === ADMIN_ROLE) return;
    void loadAvailability();
  }, [context, availabilityDate, loadAvailability]);

  useEffect(() => {
    if (!context) return;
    let isMounted = true;

    const loadRecent = async () => {
      setRecentLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !isMounted) {
        setRecentLoading(false);
        return;
      }

      let staffName = "";
      if (context.role !== ADMIN_ROLE) {
        const { data: userData } = await supabase
          .from("system_user")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        staffName = String(userData?.full_name ?? "").trim();
      }

      let query = supabase
        .from("bookings")
        .select("id, full_name, visit_reason, visit_date, start_time, end_time, created_at, book_teacher, status")
        .order("created_at", { ascending: false })
        .limit(5);

      if (staffName) {
        query = query.eq("book_teacher", staffName);
      }

      const { data } = await query;
      if (isMounted) {
        setRecentBookings(data as RecentBooking[] ?? []);
        setRecentLoading(false);
      }
    };

    void loadRecent();
    return () => { isMounted = false; };
  }, [context, supabase]);

  useEffect(() => {
    if (!context) return;
    const isAdminRole = context.role === ADMIN_ROLE;
    const isApprovedUser = isAdminRole || context.is_active === APPROVED_STATUS;
    if (!isApprovedUser) return;

    const loadSnapshot = async () => {
      setSnapshotLoading(true);
      try {
        if (isAdminRole) {
          const data = await fetchAdminSnapshot();
          setAdminSnapshot(data);
        } else {
          const data = await fetchStaffSnapshot();
          setStaffSnapshot(data);
        }
      } catch {
        // silently fail
      }
      setSnapshotLoading(false);
    };

    void loadSnapshot();
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const isAdminRole = context.role === ADMIN_ROLE;
    const isApprovedUser = isAdminRole || context.is_active === APPROVED_STATUS;
    if (!isApprovedUser) return;

    const loadHealth = async () => {
      setHealthLoading(true);
      try {
        if (isAdminRole) {
          const data = await fetchAdminScheduleHealth();
          setAdminHealth(data);
        } else {
          const data = await fetchStaffScheduleHealth();
          setStaffHealth(data);
        }
      } catch {
        // silently fail
      }
      setHealthLoading(false);
    };

    void loadHealth();
  }, [context]);

  useEffect(() => {
    if (!context) return;
    const isAdminRole = context.role === ADMIN_ROLE;
    const isApprovedUser = isAdminRole || context.is_active === APPROVED_STATUS;
    if (!isApprovedUser) return;

    const loadTrends = async () => {
      setTrendLoading(true);
      try {
        if (isAdminRole) {
          const data = await fetchAdminTrends();
          setTrendSeries(data);
        } else {
          const data = await fetchStaffTrends();
          setTrendSeries(data);
        }
      } catch {
        setTrendSeries([]);
      }
      setTrendLoading(false);
    };

    void loadTrends();
  }, [context]);

  const handleAllDayChange = useCallback((checked: boolean) => {
    setAllDayAvailable(checked);
    setAvailabilitySuccess(null);
    if (checked) {
      setAvailabilitySlots([]);
    }
  }, []);

  const toggleSlot = useCallback((slot: string) => {
    setAvailabilitySlots((prev) =>
      prev.includes(slot) ? prev.filter((item) => item !== slot) : [...prev, slot]
    );
    setAvailabilitySuccess(null);
  }, []);

  const handleSaveAvailability = useCallback(async () => {
    setAvailabilitySaving(true);
    setAvailabilityError(null);
    setAvailabilitySuccess(null);

    const result = await saveAvailability({
      allDayAvailable,
      availabilityDate,
      slots: availabilitySlots,
    });

    if (result.error) {
      setAvailabilityError(result.error);
    } else {
      setAvailabilitySuccess("Availability updated successfully.");
    }
    setAvailabilitySaving(false);
  }, [allDayAvailable, availabilityDate, availabilitySlots]);

  const isAdmin = context?.role === ADMIN_ROLE;

  const snapshotItems = useMemo(() => {
    if (isAdmin && adminSnapshot) {
      return [
        {
          title: "Total appointments",
          value: String(adminSnapshot.totalAppointments),
          desc: "Bookings for today",
          accent: "emerald" as const,
        },
        {
          title: "New bookings",
          value: String(adminSnapshot.newBookings),
          desc: "Registered today",
          accent: "sky" as const,
        },
        {
          title: "Total staff",
          value: String(adminSnapshot.totalStaff),
          desc: "All system users",
          accent: "violet" as const,
        },
        {
          title: "Pending staff",
          value: String(adminSnapshot.pendingStaff),
          desc: "Awaiting approval",
          accent: "amber" as const,
        },
        {
          title: "Check-ins today",
          value: String(adminSnapshot.checkIns),
          desc: "Visitors checked in",
          accent: "emerald" as const,
        },
        {
          title: "Pending approvals",
          value: String(adminSnapshot.pendingApprovals),
          desc: "Booking requests",
          accent: "rose" as const,
        },
      ];
    }
    if (!isAdmin && staffSnapshot) {
      return [
        {
          title: "My appointments",
          value: String(staffSnapshot.myAppointments),
          desc: "For today",
          accent: "emerald" as const,
        },
        {
          title: "Check-ins done",
          value: String(staffSnapshot.checkInsDone),
          desc: "Completed",
          accent: "sky" as const,
        },
        {
          title: "Pending check-ins",
          value: String(staffSnapshot.pendingCheckIns),
          desc: "Not yet arrived",
          accent: "amber" as const,
        },
        {
          title: "Cancellations",
          value: String(staffSnapshot.cancellations),
          desc: "Rejected bookings",
          accent: "rose" as const,
        },
      ];
    }
    return [];
  }, [isAdmin, adminSnapshot, staffSnapshot]);

  const chartData = useMemo(() => {
    if (trendSeries.length === 0) return [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const today = new Date().getDay();
    const adjustedToday = today === 0 ? 7 : today;
    const labels: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const idx = (adjustedToday - i + 7) % 7;
      labels.push(days[idx === 0 ? 6 : idx - 1]);
    }
    return labels.map((day, i) => {
      const point: Record<string, string | number> = { day };
      for (const s of trendSeries) {
        point[s.label] = s.values[i] ?? 0;
      }
      return point;
    });
  }, [trendSeries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading dashboard</CardTitle>
            <CardDescription>
              Please wait while we verify your access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isApproved = isAdmin || context?.is_active === APPROVED_STATUS;
  const isStaff = context?.role === STAFF_ROLE;
  const isEditorial = !isAdmin && !isStaff && isApproved;

  if (!isApproved) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Approval pending</CardTitle>
            <CardDescription>
              Your account is awaiting admin approval. Please check back soon.
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                Check status
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant="outline">Pending</Badge>
              <span className="text-sm text-muted-foreground">
                Signed in as {context?.email || "staff"}
              </span>
            </div>
            {error && (
              <p className="mt-4 text-sm text-destructive font-medium">
                {error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const viewLabel = isAdmin ? "Admin view" : isStaff ? "Staff view" : "Viewer";
  const viewDescription = isAdmin
    ? "Operations overview for today."
    : isStaff
      ? "Your shift overview and live queue flow."
      : "Welcome to the dashboard.";

  const scheduleHealth = (() => {
    if (isAdmin && adminHealth) {
      return [
        {
          title: "Approved today",
          value: String(adminHealth.approvedToday),
          desc: "Confirmed bookings",
          accent: "emerald" as const,
        },
        {
          title: "Rejected today",
          value: String(adminHealth.rejectedToday),
          desc: "Declined bookings",
          accent: "rose" as const,
        },
        {
          title: "Teachers available",
          value: String(adminHealth.teachersAvailable),
          desc: "Marked as available",
          accent: "violet" as const,
        },
        {
          title: "Peak hour",
          value: adminHealth.peakBookings > 0 ? adminHealth.peakHour : "N/A",
          desc: adminHealth.peakBookings > 0 ? `${adminHealth.peakBookings} bookings` : "No bookings today",
          accent: "amber" as const,
        },
        {
          title: "With vehicles",
          value: String(adminHealth.bookingsWithVehicles),
          desc: "Visitors arriving by car",
          accent: "sky" as const,
        },
      ];
    }
    if (!isAdmin && staffHealth) {
      return [
        {
          title: "My approved",
          value: String(staffHealth.myApproved),
          desc: "Confirmed for today",
          accent: "emerald" as const,
        },
        {
          title: "My rejected",
          value: String(staffHealth.myRejected),
          desc: "Declined bookings",
          accent: "rose" as const,
        },
        {
          title: "Next appointment",
          value: staffHealth.nextAppointment,
          desc: "Earliest today",
          accent: "sky" as const,
        },
        {
          title: "Slots available",
          value: String(staffHealth.availableSlotsLeft),
          desc: "Open for booking",
          accent: "amber" as const,
        },
      ];
    }
    return [];
  })();

  const formatTime = (createdAt: string) => {
    const d = new Date(createdAt);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    if (isToday) {
      return d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
    }
    return d.toLocaleDateString("en-MY", { month: "short", day: "numeric" }) +
      " " + d.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  if (isEditorial) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Welcome to the Visitor Management System.</p>
          </div>
          <Badge variant="outline">Viewer</Badge>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              You have view access to read data and reports.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <p className="text-sm text-muted-foreground max-w-md">
                Browse reports, booking history, and system data from the sidebar.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{viewDescription}</p>
        </div>
        <Badge variant="outline">{viewLabel}</Badge>
      </div>

      <div className="h-1 w-full rounded-full bg-gradient-to-r from-emerald-500/40 via-sky-500/40 to-violet-500/40" />

      <Card>
        <CardHeader>
          <div className="h-1 w-10 rounded-full bg-emerald-500/40 mb-1" />
          <CardTitle>Today at a glance</CardTitle>
          <CardDescription>
            Live snapshot of appointments and daily flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshotLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: isAdmin ? 6 : 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card p-6 shadow-xs space-y-2"
                >
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-7 w-12 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {snapshotItems.map((item) => (
                <StatCard
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  desc={item.desc}
                  accent={(item as any).accent}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card>
          <CardHeader>
            <div className="h-1 w-10 rounded-full bg-amber-500/40 mb-1" />
            <CardTitle>My availability</CardTitle>
            <CardDescription>
              Set the hours you can accept visitor appointments (08:00 - 16:30).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={allDayAvailable}
                  onCheckedChange={handleAllDayChange}
                />
                <div>
                  <p className="text-sm font-medium">Available all day</p>
                  <p className="text-xs text-muted-foreground">
                    Turn off to pick specific time slots.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Date
                </label>
                <input
                  type="date"
                  value={availabilityDate}
                  onChange={(event) => setAvailabilityDate(event.target.value)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
            </div>

            {!allDayAvailable && (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Select the 30-minute slots you are available for.
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
                  {TIME_SLOTS.map((slot) => {
                    const isSelected = availabilitySlots.includes(slot);
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => toggleSlot(slot)}
                        className={`h-9 rounded-md border text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-foreground bg-foreground text-background"
                            : "border-input hover:bg-accent"
                        }`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
                {availabilitySlots.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No slots selected yet.
                  </p>
                )}
              </div>
            )}

            {availabilityError && (
              <p className="text-sm text-destructive font-medium">
                {availabilityError}
              </p>
            )}
            {availabilitySuccess && (
              <p className="text-sm text-emerald-600 font-medium">
                {availabilitySuccess}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAvailability}
                disabled={availabilitySaving || availabilityLoading}
              >
                {availabilitySaving ? "Saving..." : "Save availability"}
              </Button>
              {availabilityLoading && (
                <span className="text-xs text-muted-foreground">
                  Loading availability...
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="h-1 w-10 rounded-full bg-indigo-500/40 mb-1" />
          <CardTitle>Schedule health</CardTitle>
          <CardDescription>
            Capacity, bottlenecks, and schedule risks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: isAdmin ? 5 : 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border bg-card p-6 shadow-xs space-y-2"
                >
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-7 w-12 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-16 rounded bg-muted animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
              {scheduleHealth.map((item) => (
                <StatCard
                  key={item.title}
                  title={item.title}
                  value={item.value}
                  desc={item.desc}
                  accent={(item as any).accent}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="h-1 w-10 rounded-full bg-sky-500/40 mb-1" />
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Latest updates that need attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentLoading ? (
                <div className="flex items-center justify-center h-20">
                  <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : recentBookings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  No bookings yet.
                </p>
              ) : (
                recentBookings.map((booking, idx) => {
                  const initial = (booking.full_name ?? "?").charAt(0).toUpperCase();
                  const colorIdx = (booking.id ?? idx) % 6;
                  const colors = [
                    "bg-blue-500",
                    "bg-emerald-500",
                    "bg-violet-500",
                    "bg-amber-500",
                    "bg-rose-500",
                    "bg-cyan-500",
                  ];
                  const timeLabel = (() => {
                    const diff = Date.now() - new Date(booking.created_at).getTime();
                    const mins = Math.floor(diff / 60000);
                    if (mins < 1) return "Just now";
                    if (mins < 60) return `${mins}m ago`;
                    const hours = Math.floor(mins / 60);
                    if (hours < 24) return `${hours}h ago`;
                    return formatTime(booking.created_at);
                  })();
                  return (
                    <div
                      key={booking.id}
                      className="flex items-start gap-3 rounded-lg border border-border/60 p-3 transition-all duration-200 ease-in-out hover:-translate-y-0.5 hover:shadow-md hover:border-foreground/20 cursor-default"
                    >
                      <div
                        className={`shrink-0 w-9 h-9 rounded-full ${colors[colorIdx]} flex items-center justify-center text-white text-sm font-semibold`}
                      >
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">
                            {booking.full_name}
                          </p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {timeLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Scheduled with <span className="font-medium text-foreground">{booking.book_teacher}</span>
                          {booking.start_time && (
                            <> at <span className="font-medium text-foreground">{booking.start_time.slice(0, 5)}</span></>
                          )}
                          {booking.visit_reason && (
                            <> &middot; {booking.visit_reason}</>
                          )}
                        </p>
                        <div className="mt-1.5">
                          <Badge
                            variant={booking.status ? "default" : "secondary"}
                            className="text-[10px] px-1.5 py-0 h-auto"
                          >
                            {booking.status ? "Confirmed" : "Pending"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-1 w-10 rounded-full bg-violet-500/40 mb-1" />
            <CardTitle>KPI trends</CardTitle>
            <CardDescription>
              Week-over-week view of key metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {trendLoading ? (
              <div className="h-64 rounded-lg bg-muted animate-pulse" />
            ) : chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data available for the last 7 days.
              </p>
            ) : (
              <div className="space-y-6">
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="day"
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "13px",
                        }}
                      />
                      {trendSeries.map((s) => (
                        <Bar
                          key={s.label}
                          dataKey={s.label}
                          fill={s.accent}
                          radius={[4, 4, 0, 0]}
                          maxBarSize={24}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {trendSeries.map((s) => (
                    <div key={s.label} className="rounded-lg border border-border/60 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.accent }} />
                        <p className="text-xs font-medium">{s.label}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{s.change}</Badge>
                      <p className="text-[10px] text-muted-foreground mt-1">{s.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}