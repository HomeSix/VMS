"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  loadContext,
  fetchStaffList,
  updateStaffStatus,
  rejectStaff,
  assignUserRole,
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
  fetchRolePermissions,
  setRolePermission,
  type StaffRecord,
  type RoleRecord,
  type RolePermissionRecord,
  type ContextData,
} from "./actions";
import { PROTECTED_PAGES } from "./constants";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { Shield, Users, FileLock, Plus, Pencil, Trash2 } from "lucide-react";

const ADMIN_ROLE = "admin";
const PENDING_STATUS = false;
const APPROVED_STATUS = true;

export default function PermissionsPage() {
  const [loading, setLoading] = useState(true);
  const [context, setContext] = useState<ContextData | null>(null);
  const [activeTab, setActiveTab] = useState("staff");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const loadContextData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadContext();
      setContext(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load context");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadContextData();
  }, [loadContextData]);

  useEffect(() => {
    if (loading) return;
    if (context && context.role !== ADMIN_ROLE) {
      router.replace("/cms/dashboard");
    }
  }, [loading, context, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Loading permissions</CardTitle>
            <CardDescription>Please wait while we fetch the latest data.</CardDescription>
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
      <div>
        <h1 className="text-2xl font-semibold">Permissions</h1>
        <p className="text-sm text-muted-foreground">
          Manage staff access, roles, and page permissions in one place.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive font-medium">{error}</p>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="staff">
            <Users className="h-4 w-4 mr-1.5" />
            Staff Access
          </TabsTrigger>
          <TabsTrigger value="roles">
            <Shield className="h-4 w-4 mr-1.5" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="pages">
            <FileLock className="h-4 w-4 mr-1.5" />
            Page Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="mt-4">
          <StaffAccessTab onError={setError} />
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <RolesTab onError={setError} />
        </TabsContent>

        <TabsContent value="pages" className="mt-4">
          <PagePermissionsTab onError={setError} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Staff Access Tab ─────────────────────────────────────────────────────────

function StaffAccessTab({ onError }: { onError: (msg: string | null) => void }) {
  const [rows, setRows] = useState<StaffRecord[]>([]);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      // Exclude admin users from the list
      if (row.role_name === ADMIN_ROLE) return false;
      
      if (!term) return true;
      const name = row.full_name?.toLowerCase() ?? "";
      const email = row.email?.toLowerCase() ?? "";
      return name.includes(term) || email.includes(term);
    });
    return filtered;
  }, [rows, search]);

  const pendingCount = rows.filter((r) => r.is_active === PENDING_STATUS).length;
  const approvedCount = rows.filter((r) => r.is_active === APPROVED_STATUS).length;

  const refresh = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const [staffData, rolesData] = await Promise.all([
        fetchStaffList(),
        fetchRoles(),
      ]);
      setRows(staffData);
      setRoles(rolesData);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to fetch staff");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateStatus = useCallback(
    async (id: string, value: boolean) => {
      setBusyId(id);
      onError(null);
      try {
        await updateStaffStatus(id, value);
        await refresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to update status");
      }
      setBusyId(null);
    },
    [refresh, onError]
  );

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget);
    onError(null);
    try {
      await rejectStaff(rejectTarget);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to reject staff");
    }
    setBusyId(null);
    setRejectTarget(null);
  }, [rejectTarget, refresh, onError]);

  const changeRole = useCallback(
    async (userId: string, roleId: string) => {
      onError(null);
      try {
        await assignUserRole(userId, roleId || null);
        await refresh();
      } catch (err) {
        onError(err instanceof Error ? err.message : "Failed to assign role");
      }
    },
    [refresh, onError]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Pending" value={pendingCount.toString()} desc="Awaiting approval" />
        <StatCard title="Approved" value={approvedCount.toString()} desc="Active accounts" />
        <StatCard title="Total" value={rows.length.toString()} desc="All staff" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff requests</CardTitle>
          <CardDescription>Approve or revoke access and assign roles.</CardDescription>
          <CardAction>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email"
              className="w-full sm:w-[220px]"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 w-full rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No staff found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const displayName = row.full_name || row.email?.split("@")[0] || "Staff";
                  const isPending = row.is_active === PENDING_STATUS;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={row.avatar_url || "/profile_default.png"}
                            alt={displayName}
                            className="h-9 w-9 rounded-full border object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/profile_default.png";
                            }}
                          />
                          <div>
                            <p className="text-sm font-medium">{displayName}</p>
                            <p className="text-xs text-muted-foreground">{row.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={row.role_id ?? "none"}
                          onValueChange={(val) => changeRole(row.id, val && val !== "none" ? val : "")}
                        >
                          <SelectTrigger className="w-[140px]" size="sm">
                            <SelectValue placeholder="No role">
                              {row.role_name || "No role"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No role</SelectItem>
                            {roles.filter((r) => r.name !== ADMIN_ROLE).map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => updateStatus(row.id, APPROVED_STATUS)}
                              disabled={busyId === row.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectTarget(row.id)}
                              disabled={busyId === row.id}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateStatus(row.id, PENDING_STATUS)}
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

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject staff</DialogTitle>
            <DialogDescription>
              This will remove their role and deactivate their account. They will no longer be able to access the CMS. This action can be undone by approving them later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busyId === rejectTarget}
            >
              {busyId === rejectTarget ? "Rejecting..." : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Roles Tab ────────────────────────────────────────────────────────────────

function RolesTab({ onError }: { onError: (msg: string | null) => void }) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [roleName, setRoleName] = useState("");
  const [roleDesc, setRoleDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await fetchRoles();
      // Filter out admin role to prevent accidental modification
      const filteredRoles = data.filter(role => role.name !== ADMIN_ROLE);
      setRoles(filteredRoles);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openCreate = () => {
    setEditingRole(null);
    setRoleName("");
    setRoleDesc("");
    setDialogOpen(true);
  };

  const openEdit = (role: RoleRecord) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDesc(role.description ?? "");
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!roleName.trim()) return;
    setSubmitting(true);
    onError(null);
    try {
      if (editingRole) {
        await updateRole(editingRole.id, roleName.trim(), roleDesc.trim() || undefined);
      } else {
        await createRole(roleName.trim(), roleDesc.trim() || undefined);
      }
      setDialogOpen(false);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to save role");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure? Users assigned to this role will lose it.")) return;
    onError(null);
    try {
      await deleteRole(id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to delete role");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Create and manage roles that can be assigned to staff members.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger render={<Button size="sm"><Plus className="h-4 w-4 mr-1.5" />New role</Button>}>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRole ? "Edit role" : "Create role"}</DialogTitle>
              <DialogDescription>
                {editingRole
                  ? "Update the role name and description."
                  : "Add a new role to assign to staff members."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="roleName">Role name</Label>
                <Input
                  id="roleName"
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. editor"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="roleDesc">Description</Label>
                <Input
                  id="roleDesc"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Brief description of this role"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={submitting || !roleName.trim()}
              >
                {submitting ? "Saving..." : editingRole ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 w-full rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <div className="rounded-xl p-6 text-center text-sm text-muted-foreground">
              No roles yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium capitalize">{role.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => openEdit(role)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleDelete(role.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page Permissions Tab ─────────────────────────────────────────────────────

function PagePermissionsTab({ onError }: { onError: (msg: string | null) => void }) {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [perms, setPerms] = useState<RolePermissionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    onError(null);
    try {
      const data = await fetchRoles();
      // Filter out admin role to prevent configuration of admin permissions
      const filteredRoles = data.filter(role => role.name !== ADMIN_ROLE);
      setRoles(filteredRoles);
      if (filteredRoles.length > 0 && !selectedRoleId) {
        setSelectedRoleId(filteredRoles[0].id);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to fetch roles");
    } finally {
      setLoading(false);
    }
  }, [onError, selectedRoleId]);

  const loadPerms = useCallback(async () => {
    if (!selectedRoleId) return;
    onError(null);
    try {
      const data = await fetchRolePermissions(selectedRoleId);
      setPerms(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to fetch permissions");
    }
  }, [selectedRoleId, onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void loadPerms();
  }, [loadPerms]);

  const isAllowed = (pagePath: string): boolean => {
    const found = perms.find((p) => p.page_path === pagePath);
    if (found) return found.can_access;
    // Default: dashboard allowed, others denied
    return pagePath === "/cms/dashboard";
  };

  const togglePage = async (pagePath: string) => {
    if (!selectedRoleId) return;
    const newValue = !isAllowed(pagePath);
    setSaving(true);
    onError(null);
    try {
      await setRolePermission(selectedRoleId, pagePath, newValue);
      await loadPerms();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to update permission");
    }
    setSaving(false);
  };

  const selectedRoleName = roles.find((r) => r.id === selectedRoleId)?.name ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Label className="text-sm font-medium whitespace-nowrap">Configure role</Label>
        <Select value={selectedRoleId} onValueChange={(val) => setSelectedRoleId(val ?? "")}>
          <SelectTrigger className="w-full sm:w-[240px]">
            <SelectValue placeholder="Select a role">
              {selectedRoleName || "Select a role"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="capitalize">{selectedRoleName || "Role"} permissions</CardTitle>
          <CardDescription>
            Toggle access for each protected page. Changes apply immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-8 w-40 rounded-lg bg-muted animate-pulse" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 w-full rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : roles.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No roles available. Create a role first.
            </div>
          ) : (
            <div className="space-y-3">
              {PROTECTED_PAGES.map((page: { page_path: string; label: string }) => {
                const allowed = isAllowed(page.page_path);
                return (
                  <div
                    key={page.page_path}
                    className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/40 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium">{page.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{page.page_path}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">
                        {allowed ? "Allowed" : "Denied"}
                      </span>
                      <Switch
                        checked={allowed}
                        onCheckedChange={() => togglePage(page.page_path)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
