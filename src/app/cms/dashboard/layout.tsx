"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-muted/30">
        <AppSidebar />

        <main className="flex-1 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <SidebarTrigger />
            <div className="text-sm text-muted-foreground">
              Welcome back 👋
            </div>
          </div>

          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}