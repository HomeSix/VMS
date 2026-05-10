"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { createClient } from "@/lib/client";
import { loadContext, type ContextData } from "../permissions/actions";

const ADMIN_ROLE = "admin";

type TeacherAvailabilityRow = {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  isAvailable: boolean;
  slotCount: number;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function TeacherAvailabilityPage() {
  const [contextLoading, setContextLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TeacherAvailabilityRow[]>([]);
  const [search, setSearch] = useState("");
  const [dateValue, setDateValue] = useState(() => toDateKey(new Date()));
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const loadContextData = useCallback(async () => {
    setContextLoading(true);
    try {
      const data = await loadContext();
      setContext(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
    }
    setContextLoading(false);
  }, []);

  useEffect(() => {
    void loadContextData();
  }, [loadContextData]);

  useEffect(() => {
    if (contextLoading) return;
    if (!context || context.role !== ADMIN_ROLE) {
      router.replace("/cms/dashboard");
    }
  }, [contextLoading, context, router]);

  const loadTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: teacherRows, error: teacherError } = await supabase
      .from("system_user")
      .select("id, full_name, email, isAvailable, is_available, roles(name)")
      .order("full_name", { ascending: true });

    if (teacherError) {
      setError(teacherError.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const normalized = (teacherRows ?? [])
      .map((row: any) => {
        const roleName = Array.isArray(row.roles)
          ? row.roles[0]?.name ?? ""
          : row.roles?.name ?? "";
        return {
          id: String(row.id),
          fullName: String(row.full_name ?? "").trim(),
          email: String(row.email ?? "").trim(),
          roleName: String(roleName ?? ""),
          isAvailable: Boolean(row.isAvailable ?? row.is_available ?? true),
        };
      })
      .filter((row) => row.fullName.length > 0);

    const teacherOnly = normalized.filter((row) => {
      const role = row.roleName.toLowerCase();
      if (!role) return false;
      return role === "staff" || role === "teacher";
    });

    const filteredTeachers = teacherOnly.length > 0 ? teacherOnly : normalized;

    const { data: availabilityRows, error: availabilityError } = await supabase
      .from("teacher_availability")
      .select("user_id, slot_time")
      .eq("available_date", dateValue);

    if (availabilityError) {
      setError(availabilityError.message);
    }

    const slotMap = new Map<string, Set<string>>();
    (availabilityRows ?? []).forEach((row: any) => {
      const userId = String(row.user_id ?? "");
      const slotTime = String(row.slot_time ?? "").slice(0, 5);
      if (!userId || slotTime.length !== 5) return;
      if (!slotMap.has(userId)) {
        slotMap.set(userId, new Set());
      }
      slotMap.get(userId)?.add(slotTime);
    });

    const merged = filteredTeachers.map((row) => ({
      ...row,
      slotCount: slotMap.get(row.id)?.size ?? 0,
    }));

    setRows(merged);
    setLoading(false);
  }, [dateValue, supabase]);

  useEffect(() => {
    if (!context || context.role !== ADMIN_ROLE) return;
    void loadTeachers();
  }, [context, loadTeachers]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const name = row.fullName.toLowerCase();
      const email = row.email.toLowerCase();
      return name.includes(term) || email.includes(term);
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    let availableAllDay = 0;
    let availableSlots = 0;
    let unavailable = 0;

    rows.forEach((row) => {
      if (row.isAvailable && row.slotCount === 0) {
        availableAllDay += 1;
        return;
      }
      if (row.slotCount > 0) {
        availableSlots += 1;
        return;
      }
      unavailable += 1;
    });

    return {
      total: rows.length,
      availableAllDay,
      availableSlots,
      unavailable,
    };
  }, [rows]);

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading availability</CardTitle>
            <CardDescription>Fetching teacher availability status.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!context || context.role !== ADMIN_ROLE) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Teacher availability</h1>
          <p className="text-sm text-muted-foreground">
            Review which teachers are available for visitors.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Date
          </label>
          <input
            type="date"
            value={dateValue}
            onChange={(event) => setDateValue(event.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total teachers" value={summary.total.toString()} desc="All profiles" />
        <StatCard
          title="Available all day"
          value={summary.availableAllDay.toString()}
          desc="IsAvailable = true"
        />
        <StatCard
          title="Available (slots)"
          value={summary.availableSlots.toString()}
          desc="Custom slots"
        />
        <StatCard
          title="Not available"
          value={summary.unavailable.toString()}
          desc="No slots"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Teacher list</CardTitle>
          <CardDescription>
            Availability status for {dateValue}.
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email"
                className="w-full sm:w-[220px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={loadTeachers}
                disabled={loading}
              >
                Refresh
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          ) : filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teachers found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Slots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const hasSlots = row.slotCount > 0;
                  const isAllDay = row.isAvailable && !hasSlots;
                  const statusLabel = isAllDay
                    ? "Available (all day)"
                    : hasSlots
                      ? "Available (slots)"
                      : "Not available";
                  const badgeVariant = isAllDay
                    ? "secondary"
                    : hasSlots
                      ? "outline"
                      : "destructive";

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.fullName}
                      </TableCell>
                      <TableCell>{row.email || "-"}</TableCell>
                      <TableCell>{row.roleName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={badgeVariant}>{statusLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        {isAllDay
                          ? "All day"
                          : hasSlots
                            ? `${row.slotCount} slots`
                            : "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
