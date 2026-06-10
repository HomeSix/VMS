"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchHistoryBookings,
  type BookingApprovalStatus,
  type BookingRecord,
  type HistoryContext,
  type HistoryFilters,
  updateBookingStatus,
} from "./actions";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

const DATE_FORMATTER = new Intl.DateTimeFormat("en-MY", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const EXPORT_OPTIONS = [
  { value: "pdf", label: "PDF" },
  { value: "excel", label: "Excel (CSV)" },
];

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

function getVisitTimestamp(booking: BookingRecord) {
  if (!booking.visit_date) return null;
  const timePart = booking.start_time?.slice(0, 8) ?? "00:00:00";
  const stamp = Date.parse(`${booking.visit_date}T${timePart}`);
  if (Number.isNaN(stamp)) return null;
  return stamp;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getVisitorStatus(status?: boolean | null) {
  if (status === true) {
    return {
      label: "Checked out",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === false) {
    return {
      label: "Checked in",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  return {
    label: "Unknown",
    className: "bg-muted text-muted-foreground border-muted",
  };
}

function getApprovalStatus(status?: BookingApprovalStatus | null) {
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

function getBookingStatus(
  approvalStatus?: BookingApprovalStatus | null,
  visitStatus?: boolean | null
) {
  if (approvalStatus !== "approved") {
    return getApprovalStatus(approvalStatus);
  }

  if (visitStatus === true || visitStatus === false) {
    return getVisitorStatus(visitStatus);
  }

  return {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  };
}

function escapeCsvValue(value: string) {
  return `"${value.replace(/"/g, "\"\"")}"`;
}

function buildCsvRows(bookings: BookingRecord[]) {
  const headers = [
    "Full name",
    "Phone",
    "Purpose",
    "Status",
    "Email",
    "Visit date",
    "Start time",
    "End time",
    "Plate number",
    "Created at",
    "Dial code",
    "Booked teacher",
  ];

  const rows = bookings.map((booking) => {
    const status = getBookingStatus(
      booking.book_status,
      booking.status
    ).label;
    return [
      booking.full_name ?? "-",
      formatPhone(booking.dial_code, booking.phone_number),
      booking.visit_reason ?? "-",
      status,
      booking.email ?? "-",
      booking.visit_date ?? "-",
      formatTime(booking.start_time),
      formatTime(booking.end_time),
      booking.plate_number ?? "-",
      booking.created_at ?? "-",
      booking.dial_code ?? "-",
      booking.book_teacher ?? "-",
    ].map((value) => escapeCsvValue(String(value)));
  });

  return [
    headers.map((value) => escapeCsvValue(value)).join(","),
    ...rows.map((row) => row.join(",")),
  ].join("\n");
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `history-${toDateKey(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function HistoryPage() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [context, setContext] = useState<HistoryContext | null>(null);
  const [filters, setFilters] = useState<HistoryFilters>({});
  const [exportFormat, setExportFormat] = useState("pdf");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  const fromDateValue = filters.fromDate
    ? new Date(`${filters.fromDate}T00:00:00`)
    : undefined;
  const toDateValue = filters.toDate
    ? new Date(`${filters.toDate}T00:00:00`)
    : undefined;

  const loadBookings = useCallback(async (nextFilters: HistoryFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchHistoryBookings(nextFilters);
      setBookings(data.bookings);
      setContext(data.context);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

  const handleSearch = () => {
    if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
      setError("From date cannot be after To date.");
      return;
    }
    void loadBookings(filters);
  };

  const handleCheckOut = useCallback(async (booking: BookingRecord) => {
    if (booking.id == null || booking.status == null) return;
    if (booking.book_status !== "approved") {
      setError("Booking must be approved before check-out.");
      return;
    }
    setBusyId(booking.id);
    setError(null);
    try {
      await updateBookingStatus(booking.id, true);
      setBookings((prev) =>
        prev.map((item) =>
          item.id === booking.id ? { ...item, status: true } : item
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setBusyId(null);
    }
  }, []);

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

  const handlePrint = () => {
    if (exportFormat === "excel") {
      downloadCsv(buildCsvRows(sortedBookings));
      return;
    }
    window.print();
  };

  const showingHint = useMemo(() => {
    if (!context?.role) return "";
    if (context.role === "staff" && context.staffName) {
      return `Showing bookings for ${context.staffName}.`;
    }
    if (context.role === "staff") {
      return "Showing bookings assigned to your account.";
    }
    return "Showing all bookings.";
  }, [context]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Booking History</h1>
        <p className="text-sm text-muted-foreground">
          Review booking records and export them when needed.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Choose a date range and run a search.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="grid gap-1">
              <Label htmlFor="from-date">From</Label>
              <Popover open={fromOpen} onOpenChange={setFromOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      id="from-date"
                      className="w-44 justify-between font-normal"
                    >
                      {filters.fromDate ? formatDate(filters.fromDate) : "Select date"}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  }
                />
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDateValue}
                    captionLayout="dropdown"
                    defaultMonth={fromDateValue}
                    onSelect={(nextDate) => {
                      setFilters((prev) => ({
                        ...prev,
                        fromDate: nextDate ? toDateKey(nextDate) : undefined,
                      }));
                      setFromOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-1">
              <Label htmlFor="to-date">To</Label>
              <Popover open={toOpen} onOpenChange={setToOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      variant="outline"
                      id="to-date"
                      className="w-44 justify-between font-normal"
                    >
                      {filters.toDate ? formatDate(filters.toDate) : "Select date"}
                      <ChevronDownIcon data-icon="inline-end" />
                    </Button>
                  }
                />
                <PopoverContent className="w-auto overflow-hidden p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDateValue}
                    captionLayout="dropdown"
                    defaultMonth={toDateValue}
                    onSelect={(nextDate) => {
                      setFilters((prev) => ({
                        ...prev,
                        toDate: nextDate ? toDateKey(nextDate) : undefined,
                      }));
                      setToOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button onClick={handleSearch} disabled={loading}>
              Search
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({});
                void loadBookings({});
              }}
              disabled={loading}
            >
              Clear
            </Button>

            <div className="flex items-end gap-2">
              <div className="grid gap-1">
                <Label htmlFor="export-format">Print format</Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value) => {
                    if (value) setExportFormat(value);
                  }}
                >
                  <SelectTrigger id="export-format" className="w-40">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={handlePrint}
                disabled={loading || bookings.length === 0}
              >
                Print
              </Button>
            </div>
          </div>

          {showingHint && <p className="mt-3 text-xs text-muted-foreground">{showingHint}</p>}

          {error && <p className="mt-3 text-sm font-medium text-destructive">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Bookings</CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="walk-in-only" className="text-xs">
                Walk-in only
              </Label>
              <Switch
                id="walk-in-only"
                checked={filters.walkInOnly ?? false}
                onCheckedChange={(checked) => {
                  const nextFilters = {
                    ...filters,
                    walkInOnly: checked,
                  };
                  setFilters(nextFilters);
                  void loadBookings(nextFilters);
                }}
              />
            </div>
          </div>
          <CardDescription>
            {loading ? "Loading data..." : `Total ${bookings.length} record(s)`}
          </CardDescription>
          <CardAction>
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
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Full name</TableHead>
                  <TableHead>No. tel</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Loading bookings...
                    </TableCell>
                  </TableRow>
                ) : sortedBookings.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No bookings found for the selected range.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedBookings.map((booking) => {
                    const status = getBookingStatus(
                      booking.book_status,
                      booking.status
                    );
                    const canCheckOut =
                      booking.book_status === "approved" && booking.status === false;
                    return (
                      <TableRow
                        key={booking.id ?? `${booking.full_name}-${booking.visit_date}`}
                      >
                        <TableCell className="font-medium">
                          {booking.full_name ?? "-"}
                        </TableCell>
                        <TableCell>
                          {formatPhone(booking.dial_code, booking.phone_number)}
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
                            {canCheckOut ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCheckOut(booking)}
                                disabled={
                                  booking.id == null ||
                                  booking.status == null ||
                                  booking.book_status !== "approved" ||
                                  busyId === booking.id
                                }
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
                                  <p className="text-xs text-muted-foreground">Status</p>
                                  <p className="text-sm font-semibold">
                                    {getBookingStatus(
                                      booking.book_status,
                                      booking.status
                                    ).label}
                                  </p>
                                </div>

                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <p className="text-xs text-muted-foreground">
                                    Approval Status
                                  </p>
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
                                  <p className="text-xs text-muted-foreground">Start time</p>
                                  <p className="text-sm font-semibold">
                                    {formatTime(booking.start_time)}
                                  </p>
                                </div>

                                <div className="rounded-lg border bg-muted/30 p-3">
                                  <p className="text-xs text-muted-foreground">End time</p>
                                  <p className="text-sm font-semibold">
                                    {formatTime(booking.end_time)}
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
                                      <p className="text-xs text-muted-foreground">
                                        Plate number
                                      </p>
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