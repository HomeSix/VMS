"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, HelpCircle, Settings, Clock, CheckCircle, XCircle } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createClient } from "@/lib/client";

const ADMIN_ROLE = "admin";
const APPROVED_STATUS = "approved";
const PENDING_STATUS = "pending";

export default function CmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userName, setUserName] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [userStatus, setUserStatus] = useState<string>(PENDING_STATUS);
  const [loading, setLoading] = useState(true);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);
  const [notifItems, setNotifItems] = useState<any[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const getUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          setLoading(false);
          return;
        }

        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        setUserName(name);

        const avatar =
          user.user_metadata?.avatar_url ||
          user.user_metadata?.picture ||
          user.identities?.[0]?.identity_data?.avatar_url ||
          user.identities?.[0]?.identity_data?.picture ||
          "";
        setUserAvatar(avatar);

        const { data: userData, error: roleError } = await supabase
          .from("system_user")
          .select("role_id, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (!roleError && userData) {
          let roleName = "";
          if (userData.role_id) {
            const { data: roleInfo } = await supabase
              .from("roles")
              .select("name")
              .eq("id", userData.role_id)
              .maybeSingle();
            roleName = roleInfo?.name ?? "";
          }
          setUserRole(roleName);
          setUserStatus(userData.is_active ? "approved" : PENDING_STATUS);
        } else {
          setUserRole("");
          setUserStatus(PENDING_STATUS);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setUserRole("");
        setUserStatus(PENDING_STATUS);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [supabase]);

  useEffect(() => {
    if (!userRole) return;
    const loadData = async () => {
      const currentUser = (await supabase.auth.getUser()).data.user;
      if (!currentUser) return;

      let staffName = "";
      if (userRole !== "admin") {
        const { data: userData } = await supabase
          .from("system_user")
          .select("full_name")
          .eq("id", currentUser.id)
          .maybeSingle();
        staffName = String(userData?.full_name ?? "").trim();
      }

      let pendingQuery = supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .or("book_status.is.null,book_status.eq.pending");

      let notifQuery = supabase
        .from("bookings")
        .select("id, full_name, book_teacher, book_status, status, visit_date, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      if (userRole === "staff" && staffName) {
        pendingQuery = pendingQuery.eq("book_teacher", staffName);
        notifQuery = notifQuery.eq("book_teacher", staffName);
      } else if (userRole === "security") {
        pendingQuery = pendingQuery.eq("email", currentUser.email);
        notifQuery = notifQuery.eq("email", currentUser.email);
      }

      const { count } = await pendingQuery;
      setPendingNotifCount(count ?? 0);

      const { data } = await notifQuery;
      setNotifItems(data ?? []);
    };
    void loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [supabase, userRole]);

  const isAdmin = userRole === ADMIN_ROLE;
  const isApproved = isAdmin || userStatus === APPROVED_STATUS;
  const isDashboard = pathname === "/cms/dashboard";
  const isPermissions = pathname === "/cms/permissions";
  const isDenied = pathname === "/cms/denied";
  const canViewPage = isDenied || isDashboard || isApproved || isPermissions;

  useEffect(() => {
    if (loading) return;
    if (isDenied) return; // always show denied page
    if (!isApproved && !isDashboard) {
      router.replace("/cms/dashboard");
    }
  }, [loading, isApproved, isDashboard, isDenied, router]);

  return (
    <SidebarProvider>
      <div className="flex flex-col min-h-screen w-full bg-muted/30">
        <div className="flex flex-1 min-h-0">
          <AppSidebar userRole={userRole} />

          <main className="flex flex-col flex-1 px-3 pt-3 sm:px-6 sm:pt-6 pb-0 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                {!loading && userRole && (
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${
                      userRole === "editor"
                        ? "bg-orange-600"
                        : userRole === "viewer"
                          ? "bg-green-600"
                          : userRole === "admin"
                            ? "bg-yellow-600"
                            : userRole === "staff"
                              ? "bg-red-600"
                              : userRole === "pending"
                                ? "bg-slate-600"
                                : "bg-gray-600"
                    }`}
                  >
                    {userRole.toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 sm:gap-2 ml-auto">
                <Popover open={notifOpen} onOpenChange={setNotifOpen}>
                  <PopoverTrigger
                    render={
                      <Button variant="ghost" size="sm" className="relative">
                        <Bell className="h-4 w-4" />
                        {pendingNotifCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-1">
                            {pendingNotifCount > 9 ? "9+" : pendingNotifCount}
                          </span>
                        )}
                        <span className="sr-only">Notifications</span>
                      </Button>
                    }
                  />
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="p-3 border-b">
                      <p className="text-sm font-semibold">Notifications</p>
                      <p className="text-xs text-muted-foreground">Recent activity</p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No recent activity.</p>
                      ) : (
                        notifItems.map((item: any) => {
                          const diff = Date.now() - new Date(item.created_at).getTime();
                          const mins = Math.floor(diff / 60000);
                          const timeAgo = mins < 1 ? "Just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ago`;
                          const statusLabel = item.book_status === "approved" ? "Approved" : item.book_status === "rejected" ? "Rejected" : "Pending";
                          return (
                            <div key={item.id} className="flex items-start gap-2 p-3 hover:bg-muted/40 transition-colors border-b last:border-b-0">
                              <div className="shrink-0 mt-0.5">
                                {item.book_status === "approved" ? <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> : item.book_status === "rejected" ? <XCircle className="h-3.5 w-3.5 text-rose-500" /> : <Clock className="h-3.5 w-3.5 text-amber-500" />}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium truncate">{item.full_name}</p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {item.book_teacher && <>with {item.book_teacher}</>}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-auto ${item.book_status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : item.book_status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                                  {statusLabel}
                                </Badge>
                                <p className="text-[9px] text-muted-foreground mt-0.5">{timeAgo}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/help")}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span className="sr-only">Help & Support</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/settings/general")}
                >
                  <Settings className="h-4 w-4" />
                  <span className="sr-only">Settings</span>
                </Button>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {loading ? (
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                  ) : (
                    <>
                      <span className="hidden sm:block truncate max-w-[350px] text-sm text-muted-foreground">
                        Welcome back,{" "}
                        <span className="font-medium text-foreground">
                          {userName}
                        </span>
                      </span>
                      <img
                        src={userAvatar || "/profile_default.png"}
                        alt={userName}
                        className="w-8 h-8 rounded-full object-cover border-2 border-background flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/profile_default.png";
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : canViewPage ? (
                children
              ) : null}
            </div>

            <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-3 sm:-mx-6 px-4 py-4 mt-6">
              <div className="flex items-center justify-center text-sm text-muted-foreground">
                Developed by 4 Man Group
              </div>
            </footer>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}