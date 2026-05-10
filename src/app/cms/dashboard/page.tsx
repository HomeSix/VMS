"use client";

import { useCallback, useEffect, useState } from "react";
import { loadContext, type ContextData } from "../permissions/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";

const ADMIN_ROLE = "admin";
const APPROVED_STATUS = true;

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const recentActivity = isAdmin
    ? [
        {
          title: "Booking created",
          detail: "Sarah L. with Dr. Hadi - 10:30",
          tag: "Booking",
          time: "09:05",
        },
        {
          title: "Schedule updated",
          detail: "Room 4 blocked for maintenance",
          tag: "Update",
          time: "08:52",
        },
        {
          title: "Cancellation",
          detail: "Aiman K. 11:00, reason: sick",
          tag: "Cancel",
          time: "08:31",
        },
        {
          title: "Walk-in added",
          detail: "Referral from Clinic B - 09:45",
          tag: "Walk-in",
          time: "08:10",
        },
        {
          title: "No-show marked",
          detail: "Ivy T. 08:00",
          tag: "Alert",
          time: "08:02",
        },
      ]
    : [
        {
          title: "Check-in complete",
          detail: "Nur A. 09:00",
          tag: "Check-in",
          time: "09:12",
        },
        {
          title: "Room change",
          detail: "Shift to Room 2 for 10:00",
          tag: "Update",
          time: "08:57",
        },
        {
          title: "New booking",
          detail: "Walk-in added for 10:45",
          tag: "Booking",
          time: "08:41",
        },
        {
          title: "Reschedule",
          detail: "Hafiz R. moved to 13:30",
          tag: "Update",
          time: "08:22",
        },
        {
          title: "Prep needed",
          detail: "Bring imaging files for 11:15",
          tag: "Task",
          time: "08:10",
        },
      ];

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
              {recentActivity.map((item) => (
                <div
                  key={`${item.title}-${item.time}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{item.tag}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                </div>
              ))}
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