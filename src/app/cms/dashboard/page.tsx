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

const ADMIN_ROLE = "admin";
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

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setAvailabilityError("Unable to update your profile.");
      setAvailabilitySaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("system_user")
      .update({ isAvailable: allDayAvailable })
      .eq("id", user.id);

    if (updateError) {
      setAvailabilityError(updateError.message);
      setAvailabilitySaving(false);
      return;
    }

    const { error: deleteError } = await supabase
      .from("teacher_availability")
      .delete()
      .eq("user_id", user.id)
      .eq("available_date", availabilityDate);

    if (deleteError) {
      setAvailabilityError(deleteError.message);
      setAvailabilitySaving(false);
      return;
    }

    if (!allDayAvailable && availabilitySlots.length > 0) {
      const payload = availabilitySlots.map((slot) => ({
        user_id: user.id,
        available_date: availabilityDate,
        slot_time: slot,
      }));

      const { error: insertError } = await supabase
        .from("teacher_availability")
        .insert(payload);

      if (insertError) {
        setAvailabilityError(insertError.message);
        setAvailabilitySaving(false);
        return;
      }
    }

    setAvailabilitySuccess("Availability updated successfully.");
    setAvailabilitySaving(false);
  }, [allDayAvailable, availabilityDate, availabilitySlots, supabase]);

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

  const isAdmin = context?.role === ADMIN_ROLE;
  const isApproved = isAdmin || context?.is_active === APPROVED_STATUS;

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

  const viewLabel = isAdmin ? "Admin view" : "Staff view";
  const viewDescription = isAdmin
    ? "Operations overview for today."
    : "Your shift overview and live queue flow.";

  const todayAtGlance = isAdmin
    ? [
        {
          title: "Total appointments",
          value: "126",
          desc: "18 within next 2 hours",
        },
        {
          title: "New bookings",
          value: "34",
          desc: "+9% vs yesterday",
        },
        {
          title: "Cancellations",
          value: "7",
          desc: "2 no-shows",
        },
        {
          title: "Walk-ins",
          value: "11",
          desc: "5 pending check-in",
        },
      ]
    : [
        {
          title: "My appointments",
          value: "12",
          desc: "Next at 10:30",
        },
        {
          title: "Check-ins done",
          value: "7",
          desc: "5 remaining",
        },
        {
          title: "Cancellations",
          value: "1",
          desc: "No-shows: 0",
        },
        {
          title: "Walk-ins",
          value: "2",
          desc: "1 waiting",
        },
      ];

  const scheduleHealth = isAdmin
    ? [
        {
          title: "Utilization",
          value: "78%",
          desc: "Peak 11:00-14:00",
        },
        {
          title: "Open slots",
          value: "22",
          desc: "Most after 16:00",
        },
        {
          title: "Overbooked slots",
          value: "3",
          desc: "Dental, Physio",
        },
        {
          title: "Avg wait time",
          value: "12 min",
          desc: "-3 min vs last week",
        },
      ]
    : [
        {
          title: "Utilization",
          value: "82%",
          desc: "Peak 11:00-13:00",
        },
        {
          title: "Open slots",
          value: "3",
          desc: "After 15:00",
        },
        {
          title: "Late starts",
          value: "1",
          desc: "Avg delay 6 min",
        },
        {
          title: "Room changes",
          value: "2",
          desc: "Confirm room swaps",
        },
      ];

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

  const trendSeries = isAdmin
    ? [
        {
          label: "Bookings",
          change: "+6% WoW",
          caption: "Total bookings last 7 days",
          values: [64, 70, 68, 72, 78, 74, 80],
          accent: "bg-emerald-500/70",
        },
        {
          label: "Cancellations",
          change: "-12% WoW",
          caption: "Lower is better",
          values: [8, 6, 7, 5, 6, 4, 5],
          accent: "bg-rose-500/70",
        },
        {
          label: "Avg wait time",
          change: "-3 min",
          caption: "Minutes between check-in and consult",
          values: [15, 14, 13, 12, 12, 11, 12],
          accent: "bg-sky-500/70",
        },
      ]
    : [
        {
          label: "My appointments",
          change: "+2% WoW",
          caption: "Appointments handled",
          values: [10, 11, 9, 12, 13, 12, 14],
          accent: "bg-emerald-500/70",
        },
        {
          label: "On-time start",
          change: "+3% WoW",
          caption: "Percent of visits starting on time",
          values: [90, 92, 88, 93, 95, 94, 96],
          accent: "bg-indigo-500/70",
        },
        {
          label: "Avg turnaround",
          change: "-2 min",
          caption: "Minutes per visit",
          values: [18, 17, 16, 15, 15, 14, 15],
          accent: "bg-amber-500/70",
        },
      ];

  const renderTrendBars = (values: number[], accent: string) => {
    const maxValue = Math.max(...values, 1);
    return (
      <div className="flex h-16 items-end gap-2">
        {values.map((value, index) => {
          const height = Math.round((value / maxValue) * 100);
          return (
            <div
              key={index}
              className="flex h-full flex-1 items-end rounded-md bg-muted/40"
            >
              <div
                className={`w-full rounded-md ${accent}`}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{viewDescription}</p>
        </div>
        <Badge variant="outline">{viewLabel}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today at a glance</CardTitle>
          <CardDescription>
            Live snapshot of appointments and daily flow.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {todayAtGlance.map((item) => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                desc={item.desc}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <Card>
          <CardHeader>
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
          <CardTitle>Schedule health</CardTitle>
          <CardDescription>
            Capacity, bottlenecks, and schedule risks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {scheduleHealth.map((item) => (
              <StatCard
                key={item.title}
                title={item.title}
                value={item.value}
                desc={item.desc}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
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
            <CardTitle>KPI trends</CardTitle>
            <CardDescription>
              Week-over-week view of key metrics.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trendSeries.map((series) => (
                <div
                  key={series.label}
                  className="rounded-lg border border-border/60 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{series.label}</p>
                    <Badge variant="outline">{series.change}</Badge>
                  </div>
                  <div className="mt-3">
                    {renderTrendBars(series.values, series.accent)}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {series.caption}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}