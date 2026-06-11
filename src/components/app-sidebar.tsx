import {
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  LogOut,
  ChevronRight,
  Calendar,
  Bell,
  HelpCircle,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/client";
import { ROLES, isElevated } from "@/lib/roles";
import { useEffect, useMemo, useState } from "react";
import menuItems from "@/data/menu-items.json";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  Calendar,
  Bell,
  HelpCircle,
};



const menuItemsData = menuItems.map((item: any) => ({
  ...item,
  icon: iconMap[item.icon] || HelpCircle,
  submenu: item.submenu ? item.submenu.map((subItem: any) => ({
    ...subItem,
    icon: iconMap[subItem.icon] || HelpCircle,
  })) : undefined,
}));

export function AppSidebar({ userRole }: { userRole?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [dynamicPaths, setDynamicPaths] = useState<Set<string> | null>(null);

  // Elevated roles (admin/superadmin) get all paths SYNCHRONOUSLY during render
  const allowedPaths = useMemo(() => {
    if (isElevated(userRole)) {
      return new Set(menuItemsData.map((item: any) => item.href).filter(Boolean));
    }
    return dynamicPaths ?? new Set(["/cms/dashboard"]);
  }, [userRole, dynamicPaths]);

  // For non-elevated roles, fetch permissions from DB
  useEffect(() => {
    if (isElevated(userRole)) return;

    const loadPermissions = async () => {
      if (!userRole || userRole === ROLES.PENDING) {
        // Leave dynamicPaths as null so fallback (dashboard only) applies
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return;
        }

        const { data: userData } = await supabase
          .from("system_user")
          .select("role_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!userData?.role_id) {
          return;
        }

        const { data: perms } = await supabase
          .from("role_permissions")
          .select("page_path, can_access")
          .eq("role_id", userData.role_id);

        const accessible = new Set<string>(["/cms/dashboard"]);
        const permMap = new Map<string, boolean>();
        for (const p of perms ?? []) {
          permMap.set(p.page_path, p.can_access);
        }
        for (const item of menuItemsData) {
          if (item.href && permMap.get(item.href) === true) {
            accessible.add(item.href);
          }
        }

        setDynamicPaths(accessible);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setDynamicPaths(new Set(["/cms/dashboard"]));
      }
    };

    loadPermissions();
  }, [userRole, supabase]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Logout error:", error);
      router.push("/auth/login");
    }
  };

  const handleNavigation = (href: string) => {
    router.push(href);
  };

  const renderMenuItem = (item: any, index: number) => {
    const isActive = item.href ? pathname === item.href : false;

    if (item.href && !allowedPaths.has(item.href)) {
      return null;
    }

    if (item.submenu) {
      return (
        <DropdownMenu key={index}>
          <DropdownMenuTrigger className="w-full flex">
            <div className="group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground peer/menu-button">
              <item.icon className="h-4 w-4" />
              <span className="ml-2 transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:overflow-hidden">
                {item.label}
              </span>
              <ChevronRight className="ml-auto h-4 w-4 transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:overflow-hidden" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" side={collapsed ? "right" : "bottom"}>
            {item.submenu.map((subItem: any, subIndex: number) => (
              <DropdownMenuItem
                key={subIndex}
                onClick={() => handleNavigation(subItem.href)}
              >
                <subItem.icon className="mr-2 h-4 w-4" />
                <span>{subItem.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div key={index} className="relative group">
        <div
          onClick={() => item.href && handleNavigation(item.href)}
          className={cn(
            "group/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground peer/menu-button cursor-pointer",
            isActive && "bg-blue-500 text-white hover:bg-blue-600 focus:bg-blue-600"
          )}
        >
          <item.icon className={cn("h-4 w-4", isActive && "text-white")} />
          <span className="ml-2 flex-1 text-left transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:overflow-hidden">
            {item.label}
          </span>
          {item.badge && (
            <span className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-xs transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:overflow-hidden",
              isActive
                ? "bg-white text-blue-500"
                : "bg-destructive text-primary-foreground"
            )}>
              {item.badge}
            </span>
          )}
        </div>
        {collapsed && (
          <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-popover text-popover-foreground rounded-md border shadow-md px-2 py-1 text-sm whitespace-nowrap">
              <p>{item.label}</p>
              {item.badge && (
                <p className="text-xs text-muted-foreground">Badge: {item.badge}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col items-center p-4">
          <img
            src="/lencana_sekolah.png"
            alt="School Badge"
            className="w-12 h-auto object-contain mb-2"
          />
          <div className="overflow-hidden transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:max-h-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:invisible">
            <div className="text-center">
              <h3 className="text-xs font-bold  leading-tight">
                SK SERI TELOK
              </h3>
              <h3 className="text-xs font-bold  leading-tight">
                PARIT YAANI
              </h3>
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItemsData.map((item, index) => (
                <SidebarMenuItem key={index}>
                  {renderMenuItem(item, index)}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
       <div className="flex justify-center pt-2  border-sidebar-border mt-2 mb-2">
          <img
            src="/stek_logo.png"
            alt="STEK Logo"
            className="h-12 w-auto object-contain"
            loading="lazy"
          />
        </div>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="relative group">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={cn(
              "w-full justify-start",
              collapsed && "px-2"
            )}
          >
            
            <LogOut className="h-4 w-4" />
            <span className="ml-2 transition-all duration-200 ease-linear group-data-[collapsible=offcanvas]:w-0 group-data-[collapsible=offcanvas]:opacity-0 group-data-[collapsible=offcanvas]:overflow-hidden">Logout</span>
          </Button>
          {collapsed && (
            <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <div className="bg-popover text-popover-foreground rounded-md border shadow-md px-2 py-1 text-sm whitespace-nowrap">
                <p>Logout</p>
              </div>
            </div>
          )}
        </div>
       
      </SidebarFooter>
    </Sidebar>
  );
}