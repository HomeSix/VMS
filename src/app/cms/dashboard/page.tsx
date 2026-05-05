"use client";

import { useCallback, useEffect, useState } from "react";
import { loadContext, type ContextData } from "../staff-approvals/actions";
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

  const isApproved =
    context?.role === ADMIN_ROLE || context?.is_active === APPROVED_STATUS;

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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Users" value="1,248" desc="+12% this week" />
        <StatCard title="Revenue" value="RM 32,450" desc="+8% this month" />
        <StatCard title="Active Projects" value="23" desc="3 new added" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your system is running smoothly. No critical alerts.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">System Overview</h2>
          <p className="text-sm text-muted-foreground mt-2">
            CPU, memory, and API status will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}