"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { ChevronDownIcon } from "lucide-react";

const ADMIN_ROLE = "admin";

type TeacherAvailabilityRow = {
  id: string;
  fullName: string;
  email: string;
  roleName: string;
  isAvailable: boolean;
  slotCount: number;
};

type BookingRange = {
  start: string;
  end: string;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (date: Date) =>
  new Intl.DateTimeFormat("en-MY", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);

export default function TeacherAvailabilityPage() {
  const [contextLoading, setContextLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TeacherAvailabilityRow[]>([]);
  const [search, setSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [bookingsByTeacher, setBookingsByTeacher] = useState(
    new Map<string, BookingRange[]>()
  );
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const dateValue = date ? toDateKey(date) : "";

  useEffect(() => {
    setDate(new Date());
  }, []);

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
      .select("id, full_name, email, isAvailable, roles(name)")
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
          isAvailable: Boolean(row.isAvailable ?? true),
        };
      })
      .filter((row) => row.fullName.length > 0);

    const teacherOnly = normalized.filter((row) => {
      const role = row.roleName.toLowerCase();
      if (!role) return false;
      return role === "staff" || role === "teacher";
    });

    const filteredTeachers = teacherOnly.length > 0 ? teacherOnly : normalized;

    const [availabilityResult, bookingResult] = await Promise.all([
      supabase
        .from("teacher_availability")
        .select("id, slot_time")  
        .eq("available_date", dateValue),
      supabase
        .from("bookings")
        .select("start_time, end_time, book_teacher")
        .eq("visit_date", dateValue)
        .or("book_status.is.null,book_status.eq.pending,book_status.eq.approved")
        .order("start_time", { ascending: true }),
    ]);

    const errors = [availabilityResult.error, bookingResult.error]
      .map((err) => err?.message)
      .filter(Boolean);
    if (errors.length > 0) {
      setError(errors.join(" | "));
    }

    const slotMap = new Map<string, Set<string>>();
    (availabilityResult.data ?? []).forEach((row: any) => {
      const userId = String(row.id ?? "");
      const slotTime = String(row.slot_time ?? "").slice(0, 5);
      if (!userId || slotTime.length !== 5) return;
      if (!slotMap.has(userId)) {
        slotMap.set(userId, new Set());
      }
      slotMap.get(userId)?.add(slotTime);
    });

    const bookingsMap = new Map<string, BookingRange[]>();
    (bookingResult.data ?? []).forEach((row: any) => {
      const teacherName = String(row.book_teacher ?? "").trim();
      const start = String(row.start_time ?? "").slice(0, 5);
      const end = String(row.end_time ?? "").slice(0, 5);
      if (!teacherName || start.length !== 5 || end.length !== 5) return;
      const existing = bookingsMap.get(teacherName) ?? [];
      existing.push({ start, end });
      bookingsMap.set(teacherName, existing);
    });

    const merged = filteredTeachers.map((row) => ({
      ...row,
      slotCount: slotMap.get(row.id)?.size ?? 0,
    }));

    setRows(merged);
    setBookingsByTeacher(bookingsMap);
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
          <FieldLabel
            htmlFor="availability-date"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
          >
            Date
          </FieldLabel>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  id="availability-date"
                  className="w-60 justify-between font-normal"
                >
                  {date ? formatDateForDisplay(date) : "Select date"}
                  <ChevronDownIcon data-icon="inline-end" />
                </Button>
              }
            />
           <PopoverContent className="w-auto overflow-hidden p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                captionLayout="dropdown"
                defaultMonth={date}
                onSelect={(nextDate) => {
                  setDate(nextDate);
                  setDateOpen(false);
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total teachers" value={summary.total.toString()} desc="" />
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
                  const bookingRanges = bookingsByTeacher.get(row.fullName) ?? [];
                  const hasBookings = bookingRanges.length > 0;
                  const statusLabel = isAllDay
                    ? hasBookings
                      ? "Available"
                      : "Available (all day)"
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
                        {isAllDay ? (
                          <Dialog>
                            <DialogTrigger
                              render={
                                <button
                                  type="button"
                                  className="inline-flex"
                                  aria-label={`View ${row.fullName} availability details`}
                                >
                                  <Badge variant={badgeVariant}>{statusLabel}</Badge>
                                </button>
                              }
                            />
                            <DialogContent className="max-w-lg">
                              <DialogHeader>
                                <DialogTitle>{row.fullName}</DialogTitle>
                                <DialogDescription>
                                  {bookingRanges.length > 0
                                    ? `Booked time ranges on ${dateValue}.`
                                    : `No bookings yet for ${dateValue}. This teacher is fully available.`}
                                </DialogDescription>
                              </DialogHeader>
                              {bookingRanges.length > 0 ? (
                                <div className="grid gap-2">
                                  {bookingRanges.map((range, index) => (
                                    <div
                                      key={`${range.start}-${range.end}-${index}`}
                                      className="rounded-lg border bg-muted/30 px-3 py-2"
                                    >
                                      <p className="text-sm font-semibold">
                                        {range.start} - {range.end}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        Booked
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
                                  No blocked times.
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Badge variant={badgeVariant}>{statusLabel}</Badge>
                        )}
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
