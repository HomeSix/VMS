"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadContext,
  fetchStaffList,
  updateStaffStatus,
  type StaffRecord,
  type ContextData,
} from "./actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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

const ADMIN_ROLE = "admin";
const PENDING_STATUS = false;
const APPROVED_STATUS = true;

export default function StaffApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [rows, setRows] = useState<StaffRecord[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const router = useRouter();

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const name = row.full_name?.toLowerCase() ?? "";
      const email = row.email?.toLowerCase() ?? "";
      return name.includes(term) || email.includes(term);
    });
  }, [rows, search]);

  const pendingCount = rows.filter(
    (row) => row.is_active === PENDING_STATUS
  ).length;
  const approvedCount = rows.filter(
    (row) => row.is_active === APPROVED_STATUS
  ).length;

  const refreshStaff = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchStaffList();
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch staff");
    }
  }, []);

  const loadContextData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadContext();
      setContext(data);
      if (data?.role === ADMIN_ROLE) {
        await refreshStaff();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
    }
    setLoading(false);
  }, [refreshStaff]);

  const updateStatus = useCallback(
    async (id: string, value: boolean) => {
      setBusyId(id);
      setError(null);
      try {
        await updateStaffStatus(id, value);
        await refreshStaff();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update status");
      }
      setBusyId(null);
    },
    [refreshStaff]
  );

  useEffect(() => {
    void loadContextData();
  }, [loadContextData]);

  const handleCheckStatus = useCallback(async () => {
    try {
      const updatedContext = await loadContext();
      setContext(updatedContext);
      if (updatedContext?.is_active === APPROVED_STATUS) {
        router.replace("/cms/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check status");
    }
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading staff approvals</CardTitle>
            <CardDescription>
              Please wait while we fetch the latest data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!context || context.role !== ADMIN_ROLE) {
    const approved = context?.is_active === APPROVED_STATUS;
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {approved ? "Access approved" : "Approval pending"}
            </CardTitle>
            <CardDescription>
              {approved
                ? "Your staff access is active. You can continue to the dashboard."
                : "Your account is awaiting admin approval. Please check back soon."}
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                Check status
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={approved ? "secondary" : "outline"}>
                {approved ? "Approved" : "Pending"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Signed in as {context?.email || "staff"}
              </span>
            </div>
            {error && (
              <p className="mt-4 text-sm text-destructive font-medium">{error}</p>
            )}
          </CardContent>
          {approved && (
            <CardFooter className="border-t">
              <Button onClick={() => router.push("/cms/dashboard")}>
                Go to dashboard
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Staff approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review new staff logins and approve dashboard access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshStaff}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending requests"
          value={pendingCount.toString()}
          desc="Awaiting admin approval"
        />
        <StatCard
          title="Approved staff"
          value={approvedCount.toString()}
          desc="Active staff accounts"
        />
        <StatCard
          title="Total staff"
          value={rows.length.toString()}
          desc="Pending and approved"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff requests</CardTitle>
          <CardDescription>
            Approve or revoke access for staff members.
          </CardDescription>
          <CardAction className="w-full sm:w-auto">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="w-full sm:w-[220px]"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive font-medium">{error}</p>
          )}

          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No staff requests match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const displayName =
                    row.full_name || row.email?.split("@")[0] || "Staff";
                  const isPending = row.is_active === PENDING_STATUS;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={row.avatar_url || "/profile_default.png"}
                            alt={displayName}
                            className="h-9 w-9 rounded-full border object-cover"
                            onError={(event) => {
                              (event.target as HTMLImageElement).src =
                                "/profile_default.png";
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isPending ? "outline" : "secondary"}>
                          {isPending ? "Pending" : "Approved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatus(row.id, APPROVED_STATUS)
                              }
                              disabled={busyId === row.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatus(row.id, PENDING_STATUS)
                              }
                              disabled={busyId === row.id}
                            >
                              Keep pending
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatus(row.id, PENDING_STATUS)
                            }
                            disabled={busyId === row.id}
                          >
                            Revoke access
                          </Button>
                        )}
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
        </Card>
      </div>
    );
  }

  if (currentRole !== ADMIN_ROLE) {
    const approved = isActive === APPROVED_STATUS;
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {approved ? "Access approved" : "Approval pending"}
            </CardTitle>
            <CardDescription>
              {approved
                ? "Your staff access is active. You can continue to the dashboard."
                : "Your account is awaiting admin approval. Please check back soon."}
            </CardDescription>
            <CardAction>
              <Button variant="outline" size="sm" onClick={handleCheckStatus}>
                Check status
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Badge variant={approved ? "secondary" : "outline"}>
                {approved ? "Approved" : "Pending"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Signed in as {currentEmail || "staff"}
              </span>
            </div>
            {error && (
              <p className="mt-4 text-sm text-destructive font-medium">{error}</p>
            )}
          </CardContent>
          {approved && (
            <CardFooter className="border-t">
              <Button onClick={() => router.push("/cms/dashboard")}>
                Go to dashboard
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Staff approvals</h1>
          <p className="text-sm text-muted-foreground">
            Review new staff logins and approve dashboard access.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshStaff}>
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Pending requests"
          value={pendingCount.toString()}
          desc="Awaiting admin approval"
        />
        <StatCard
          title="Approved staff"
          value={approvedCount.toString()}
          desc="Active staff accounts"
        />
        <StatCard
          title="Total staff"
          value={rows.length.toString()}
          desc="Pending and approved"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff requests</CardTitle>
          <CardDescription>
            Approve or revoke access for staff members.
          </CardDescription>
          <CardAction className="w-full sm:w-auto">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or email"
              className="w-full sm:w-[220px]"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {error && (
            <p className="mb-4 text-sm text-destructive font-medium">{error}</p>
          )}

          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No staff requests match your search.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const displayName =
                    row.full_name || row.email?.split("@")[0] || "Staff";
                  const isPending = row.is_active === PENDING_STATUS;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={row.avatar_url || "/profile_default.png"}
                            alt={displayName}
                            className="h-9 w-9 rounded-full border object-cover"
                            onError={(event) => {
                              (event.target as HTMLImageElement).src =
                                "/profile_default.png";
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{displayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {row.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isPending ? "outline" : "secondary"}>
                          {isPending ? "Pending" : "Approved"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateStatus(row.id, APPROVED_STATUS)
                              }
                              disabled={busyId === row.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateStatus(row.id, PENDING_STATUS)
                              }
                              disabled={busyId === row.id}
                            >
                              Keep pending
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              updateStatus(row.id, PENDING_STATUS)
                            }
                            disabled={busyId === row.id}
                          >
                            Revoke access
                          </Button>
                        )}
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