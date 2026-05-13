"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  fetchApprovalBookings,
  updateBookingApproval,
  updateBookingVisitStatus,
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
import { loadContext, type ContextData } from "../permissions/actions";

const ADMIN_ROLE = "admin";
const SECURITY_ROLE = "security";

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

function getVisitTimestamp(booking: BookingApprovalRecord) {
  if (!booking.visit_date) return Number.POSITIVE_INFINITY;
  const timePart = booking.start_time?.slice(0, 8) ?? "00:00:00";
  const stamp = Date.parse(`${booking.visit_date}T${timePart}`);
  if (Number.isNaN(stamp)) return Number.POSITIVE_INFINITY;
  return stamp;
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
    if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE)) {
      router.replace("/cms/dashboard");
    }
  }, [contextLoading, context, router]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalBookings();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE)) return;
    void loadBookings();
  }, [context, loadBookings]);

  const handleDecision = useCallback(
    async (booking: BookingApprovalRecord, status: Exclude<ApprovalStatus, "pending">) => {
      if (booking.id == null) return;
      setBusyId(booking.id);
      setError(null);
      try {
        await updateBookingApproval(booking.id, status);
        setBookings((prev) => {
          if (context?.role === ADMIN_ROLE) {
            return prev.filter((item) => item.id !== booking.id);
          }
          return prev.map((item) =>
            item.id === booking.id ? { ...item, book_status: status } : item
          );
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update booking.");
      } finally {
        setBusyId(null);
      }
    },
    [context?.role]
  );

  const handleCheckOut = useCallback(
    async (booking: BookingApprovalRecord) => {
      if (booking.id == null) return;
      if (booking.book_status !== "approved") {
        setError("Booking must be approved before check-out.");
        return;
      }
      setBusyId(booking.id);
      setError(null);
      try {
        await updateBookingVisitStatus(booking.id, true);
        setBookings((prev) =>
          prev.map((item) =>
            item.id === booking.id ? { ...item, status: true } : item
          )
        );
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

  const sortedBookings = useMemo(() => {
    const items = [...bookings];
    items.sort((a, b) => {
      const timeDiff = getVisitTimestamp(b) - getVisitTimestamp(a);
      if (timeDiff !== 0) return timeDiff;
      return String(a.full_name ?? "").localeCompare(String(b.full_name ?? ""));
    });
    return items;
  }, [bookings]);

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

  if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE)) {
    return null;
  }

  const isSecurity = context.role === SECURITY_ROLE;
  const headerDescription = isSecurity
    ? "Review bookings assigned to your security account."
    : "Review pending bookings and decide whether to approve or reject them.";
  const tableTitle = isSecurity ? "Assigned bookings" : "Pending bookings";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Booking approvals</h1>
          <p className="text-sm text-muted-foreground">
            {headerDescription}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
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
                ) : sortedBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No bookings found.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBookings.map((booking) => {
                    const approvalStatus = getApprovalStatus(booking.book_status);
                    const isPending =
                      booking.book_status == null || booking.book_status === "pending";
                    const canApprove = isPending;
                    const canReject = isPending;
                    const canCheckOut =
                      booking.book_status === "approved" && booking.status !== true;
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
                            className={`border ${approvalStatus.className}`}
                          >
                            {approvalStatus.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canApprove ? (
                              <Button
                                size="sm"
                                onClick={() => handleDecision(booking, "approved")}
                                disabled={booking.id == null || busyId === booking.id}
                              >
                                Approve
                              </Button>
                            ) : null}
                            {canReject ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDecision(booking, "rejected")}
                                disabled={booking.id == null || busyId === booking.id}
                              >
                                Reject
                              </Button>
                            ) : null}
                            {canCheckOut ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckOut(booking)}
                                disabled={booking.id == null || busyId === booking.id}
                              >
                                Check out
                              </Button>
                            ) : null}
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
                                    <p className="text-xs text-muted-foreground">Approval status</p>
                                    <p className="text-sm font-semibold">
                                      {getApprovalStatus(booking.book_status).label}
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
                                    <p className="text-xs text-muted-foreground">Booked teacher</p>
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
