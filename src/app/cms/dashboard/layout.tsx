"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { createClient } from "@/lib/client";
import { useEffect, useState } from "react";
import { Bell, HelpCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [userName, setUserName] = useState<string>("");
  const [userAvatar, setUserAvatar] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const name = user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'User';
          setUserName(name);

          const avatar = user.user_metadata?.avatar_url ||
            user.user_metadata?.picture ||
            user.identities?.[0]?.identity_data?.avatar_url ||
            user.identities?.[0]?.identity_data?.picture ||
            '';
          setUserAvatar(avatar);

          console.log('Fetching role for user UUID:', user.id);
          const { data: userData, error } = await supabase
            .from('system_user')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          console.log('Role query result:', { userData, error });

          if (error) {
            console.error('Error fetching user role:', error);
          } else if (userData?.role) {
            setUserRole(userData.role);
            console.log('User role set to:', userData.role);
          } else {
            console.log('No role found for user');
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, []);

  return (
    <SidebarProvider>
      {/* Outer wrapper: full height, flex column */}
      <div className="flex flex-col min-h-screen w-full bg-muted/30">

        {/* Middle row: sidebar + main content, grows to fill space */}
        <div className="flex flex-1 min-h-0">
          <AppSidebar />

       <main className="flex flex-col flex-1 px-3 pt-3 sm:px-6 sm:pt-6 pb-0 min-w-0">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-6">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                {!loading && userRole && (
                  <div className={`px-2 py-1 rounded-full text-xs font-semibold text-white ${
                    userRole === 'editor'
                      ? 'bg-orange-600'
                      : userRole === 'viewer'
                        ? 'bg-green-600'
                        : userRole === 'admin'
                          ? 'bg-yellow-600'
                          : userRole === 'staff'
                            ? 'bg-red-600'
                            : 'bg-gray-600'
                  }`}>
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
                        <span className="font-medium text-foreground">{userName}</span>
                      </span>
                      <img
                        src={userAvatar || "/profile_default.png"}
                        alt={userName}
                        className="w-8 h-8 rounded-full object-cover border-2 border-background flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/profile_default.png";
                        }}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 space-y-6">
              {children}
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