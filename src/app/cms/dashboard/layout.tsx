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
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Try to get user's display name, fallback to email
          const name = user.user_metadata?.full_name || 
                      user.user_metadata?.name || 
                      user.email?.split('@')[0] || 
                      'User';
          setUserName(name);
          
          // Get user avatar from metadata or identities
          const avatar = user.user_metadata?.avatar_url || 
                        user.user_metadata?.picture ||
                        user.identities?.[0]?.identity_data?.avatar_url ||
                        user.identities?.[0]?.identity_data?.picture ||
                        '';
          setUserAvatar(avatar);
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
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />

        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              
            </div>
            
            <div className="flex items-center gap-2">
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
                  <>
                    <div className="w-8 h-8 rounded-full bg-muted animate-pulse"></div>
                    <span>Welcome back</span>
                  </>
                ) : (
                  <>
                    <span>Welcome back, {userName}</span>
                    {userAvatar ? (
                      <img 
                        src={userAvatar} 
                        alt={userName} 
                        className="w-8 h-8 rounded-full object-cover border-2 border-background"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}