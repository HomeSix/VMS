"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  fetchPendingBookings,
  updateBookingApproval,
  type BookingApprovalRecord,
  type ApprovalStatus,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { loadContext, type ContextData } from "../permissions/actions";

const ADMIN_ROLE = "admin";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return DATE_FORMATTER.format(date);
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function formatPhone(dialCode?: string | null, phone?: string | null) {
  const dial = String(dialCode ?? "").trim();
  const number = String(phone ?? "").trim();
  if (!dial && !number) return "-";
  if (dial && number) return `${dial} ${number}`;
  return dial || number;
}

function getApprovalStatus(status?: ApprovalStatus | null) {
  if (status === "approved") {
    return {
      label: "Approved",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rejected",
      className: "bg-rose-50 text-rose-700 border-rose-200",
    };
  }

  return {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  };
}

export default function BookingApprovalsPage() {
  const [contextLoading, setContextLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [bookings, setBookings] = useState<BookingApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
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

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPendingBookings();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!context || context.role !== ADMIN_ROLE) return;
    void loadBookings();
  }, [context, loadBookings]);

  const handleDecision = useCallback(
    async (booking: BookingApprovalRecord, status: Exclude<ApprovalStatus, "pending">) => {
      if (booking.id == null) return;
      setBusyId(booking.id);
      setError(null);
      try {
        await updateBookingApproval(booking.id, status);
        setBookings((prev) => prev.filter((item) => item.id !== booking.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update booking.");
      } finally {
        setBusyId(null);
      }
    },
    []
  );

  const summary = useMemo(() => {
    const total = bookings.length;
    return { total };
  }, [bookings.length]);

  if (contextLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading approvals</CardTitle>
            <CardDescription>Fetching pending bookings.</CardDescription>
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
          <h1 className="text-2xl font-semibold">Booking approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review pending bookings and decide whether to approve or reject them.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Pending bookings</CardTitle>
          <CardDescription>
            {loading ? "Loading data..." : `Total ${summary.total} request(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Visitor</TableHead>
                  <TableHead>Visit date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Loading bookings...
                    </TableCell>
                  </TableRow>
                ) : bookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No pending bookings.
                    </TableCell>
                  </TableRow>
                ) : (
                  bookings.map((booking) => {
                    const status = getApprovalStatus(booking.book_status);
                    return (
                      <TableRow key={booking.id ?? booking.created_at ?? booking.full_name}>
                        <TableCell className="font-medium">
                          {booking.full_name ?? "-"}
                        </TableCell>
                        <TableCell>{formatDate(booking.visit_date)}</TableCell>
                        <TableCell>
                          {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                        </TableCell>
                        <TableCell>{booking.visit_reason ?? "-"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("border", status.className)}
                          >
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleDecision(booking, "approved")}
                              disabled={booking.id == null || busyId === booking.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDecision(booking, "rejected")}
                              disabled={booking.id == null || busyId === booking.id}
                            >
                              Reject
                            </Button>
                            <Dialog>
                              <DialogTrigger
                                render={
                                  <Button variant="secondary" size="sm">
                                    Details
                                  </Button>
                                }
                              />
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Booking details</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Full name</p>
                                    <p className="text-sm font-semibold">
                                      {booking.full_name ?? "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Phone</p>
                                    <p className="text-sm font-semibold">
                                      {formatPhone(booking.dial_code, booking.phone_number)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="text-sm font-semibold">
                                      {booking.email ?? "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Purpose</p>
                                    <p className="text-sm font-semibold">
                                      {booking.visit_reason ?? "-"}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Visit date</p>
                                    <p className="text-sm font-semibold">
                                      {formatDate(booking.visit_date)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Time</p>
                                    <p className="text-sm font-semibold">
                                      {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                                    </p>
                                  </div>
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-xs text-muted-foreground">Teacher</p>
                                    <p className="text-sm font-semibold">
                                      {booking.book_teacher ?? "-"}
                                    </p>
                                  </div>
                                  {String(booking.plate_number ?? "").trim() ? (
                                    <div className="rounded-lg border bg-muted/30 p-3">
                                      <p className="text-xs text-muted-foreground">Plate number</p>
                                      <p className="text-sm font-semibold">
                                        {booking.plate_number}
                                      </p>
                                    </div>
                                  ) : null}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
