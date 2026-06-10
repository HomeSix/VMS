"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  fetchApprovalBookings,
  updateBookingApproval,
  updateBookingVisitStatus,
  cancelBookingApproval,
  type BookingApprovalRecord,
  type ApprovalStatus,
} from "./actions";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldLabel } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { loadContext, type ContextData } from "../permissions/actions";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

const ADMIN_ROLE = "admin";
const SECURITY_ROLE = "security";
const STAFF_ROLE = "staff";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

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
  if (!booking.visit_date) return null;
  const timePart = booking.start_time?.slice(0, 8) ?? "00:00:00";
  const stamp = Date.parse(`${booking.visit_date}T${timePart}`);
  if (Number.isNaN(stamp)) return null;
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
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");
  const [dateOpen, setDateOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [walkInOnly, setWalkInOnly] = useState(false);
  const router = useRouter();
  const dateValue = date ? toDateKey(date) : "";

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
    if (context?.role === SECURITY_ROLE) {
      setDate(new Date());
    }
  }, [context]);

  useEffect(() => {
    if (contextLoading) return;
    if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE && context.role !== STAFF_ROLE)) {
      router.replace("/cms/dashboard");
    }
  }, [contextLoading, context, router]);

  const loadBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchApprovalBookings(dateValue, walkInOnly);
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setLoading(false);
    }
  }, [dateValue, walkInOnly]);

  useEffect(() => {
    if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE && context.role !== STAFF_ROLE)) return;
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

  const handleCancel = useCallback(
    async (booking: BookingApprovalRecord) => {
      if (booking.id == null) return;
      const visitorPhone = booking.dial_code && booking.phone_number ? `${booking.dial_code} ${booking.phone_number}` : "No phone";
      if (!confirm(`Cancel this approved booking?\n\nVisitor: ${booking.full_name}\nPhone: ${visitorPhone}\n\nPlease contact them to inform about the cancellation.`)) return;
      setBusyId(booking.id);
      setError(null);
      try {
        await cancelBookingApproval(booking.id);
        setBookings((prev) =>
          prev.map((item) =>
            item.id === booking.id ? { ...item, book_status: "pending" } : item
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to cancel booking.");
      } finally {
        setBusyId(null);
      }
    },
    []
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
      const aStamp = getVisitTimestamp(a);
      const bStamp = getVisitTimestamp(b);
      const nameDiff = String(a.full_name ?? "").localeCompare(
        String(b.full_name ?? "")
      );

      if (aStamp == null && bStamp == null) return nameDiff;
      if (aStamp == null) return 1;
      if (bStamp == null) return -1;

      const timeDiff = aStamp - bStamp;
      if (timeDiff !== 0) {
        return sortDirection === "asc" ? timeDiff : -timeDiff;
      }
      return nameDiff;
    });
    return items;
  }, [bookings, sortDirection]);
  const isLatestFirst = sortDirection === "desc";

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

  if (!context || (context.role !== ADMIN_ROLE && context.role !== SECURITY_ROLE && context.role !== STAFF_ROLE)) {
    return null;
  }

  const isSecurity = context.role === SECURITY_ROLE;
  const isStaff = context.role === STAFF_ROLE;
  const headerDescription = isSecurity
    ? "Review bookings assigned to your security account."
    : isStaff
      ? "Review pending bookings from visitors who want to meet you."
      : "Review pending bookings and decide whether to approve or reject them.";
  const tableTitle = isSecurity ? "Assigned bookings" : "Pending bookings";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Booking approvals</h1>
          <p className="text-sm text-muted-foreground">
            {headerDescription}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isSecurity && (
            <div className="flex items-center gap-2 text-sm">
              <FieldLabel
                htmlFor="approvals-date"
                className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
              >
                Date
              </FieldLabel>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      id="approvals-date"
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
              {date && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDate(undefined);
                    setDateOpen(false);
                  }}
                  aria-label="Display all appointments"
                >
                  Display All
                </Button>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={loadBookings} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
          <CardDescription>
            {loading
              ? "Loading data..."
              : `Total ${summary.total} request(s)${dateValue ? ` for ${dateValue}` : ""}`}
          </CardDescription>
          <CardAction>
            <div className="flex items-center gap-3">
              {isSecurity && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="walk-in-only" className="text-xs">
                    Walk-In only
                  </Label>
                  <Switch
                    id="walk-in-only"
                    checked={walkInOnly}
                    onCheckedChange={setWalkInOnly}
                    disabled={loading}
                  />
                </div>
              )}
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() =>
                  setSortDirection((current) =>
                    current === "desc" ? "asc" : "desc"
                  )
                }
                aria-label="Sort by visit date"
                title={isLatestFirst ? "Latest first" : "Earliest first"}
              >
                {isLatestFirst ? <ChevronDownIcon /> : <ChevronUpIcon />}
              </Button>
            </div>
          </CardAction>
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
                    const isWalkIn = booking.email === "security@example.com";
                    const canApprove = isPending && isWalkIn;
                    const canReject = isPending && isWalkIn;
                    const canCheckOut =
                      booking.book_status === "approved" && booking.status !== true && isWalkIn;
                    const canCancel =
                      booking.book_status === "approved" && isWalkIn;
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
                            {canCancel ? (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancel(booking)}
                                disabled={booking.id == null || busyId === booking.id}
                              >
                                Cancel
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
