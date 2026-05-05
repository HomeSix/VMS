"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, HelpCircle, Settings } from "lucide-react";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
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
          .select("role, status")
          .eq("id", user.id)
          .maybeSingle();

        if (!roleError) {
          setUserRole(userData?.role ?? "");
          setUserStatus(userData?.status ?? PENDING_STATUS);
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

  const isAdmin = userRole === ADMIN_ROLE;
  const isApproved = isAdmin || userStatus === APPROVED_STATUS;
  const isDashboard = pathname === "/cms/dashboard";
  const isStaffApprovals = pathname === "/cms/staff-approvals";
  const canViewPage = isDashboard || isApproved || (isStaffApprovals && isAdmin);

  useEffect(() => {
    if (loading) return;
    if (isStaffApprovals && !isAdmin) {
      router.replace("/cms/dashboard");
      return;
    }
    if (!isApproved && !isDashboard) {
      router.replace("/cms/dashboard");
    }
  }, [loading, isAdmin, isApproved, isDashboard, isStaffApprovals, router]);

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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/notifications")}
                  className="relative"
                >
                  <Bell className="h-4 w-4" />
                  <span className="sr-only">Notifications</span>
                </Button>

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