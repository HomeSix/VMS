import {
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  Settings,
  LogOut,
  ChevronRight,
  FolderOpen,
  Calendar,
  Mail,
  BarChart3,
  Shield,
  Database,
  Globe,
  HelpCircle,
  Package,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Archive,
  Trash2,
  Bell,
  Search,
  Plus,
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
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/client";
import { useEffect, useState } from "react";
import menuItems from "@/data/menu-items.json";

const iconMap: { [key: string]: any } = {
  LayoutDashboard,
  FileText,
  Users,
  UserCheck,
  Settings,
  ChevronRight,
  FolderOpen,
  Calendar,
  Mail,
  BarChart3,
  Shield,
  Database,
  Globe,
  HelpCircle,
  Package,
  ShoppingCart,
  CreditCard,
  TrendingUp,
  Archive,
  Trash2,
  Bell,
  Search,
  Plus,
};

const SECURITY_ROLE = "security";
const SECURITY_ALLOWED_PATHS = ["/cms/dashboard", "/cms/approvals"];

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
  const supabase = createClient();
  const [canAccessPermissions, setCanAccessPermissions] = useState(false);

  
  useEffect(() => {
    const checkPermissions = async () => {
      if (!userRole || userRole === "pending") {
        setCanAccessPermissions(false);
        return;
      }

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setCanAccessPermissions(false);
          return;
        }

        const { data: userData } = await supabase
          .from("system_user")
          .select("role_id")
          .eq("id", user.id)
          .maybeSingle();

        if (!userData?.role_id) {
          setCanAccessPermissions(false);
          return;
        }

        // Admin always has access
        if (userRole === "admin") {
          setCanAccessPermissions(true);
          return;
        }

        // Check role permissions for /cms/permissions
        const { data: perm } = await supabase
          .from("role_permissions")
          .select("can_access")
          .eq("role_id", userData.role_id)
          .eq("page_path", "/cms/permissions")
          .maybeSingle();

        setCanAccessPermissions(perm?.can_access || false);
      } catch (error) {
        console.error("Error checking permissions:", error);
        setCanAccessPermissions(false);
      }
    };

    checkPermissions();
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

    if (userRole === SECURITY_ROLE) {
      if (!item.href || !SECURITY_ALLOWED_PATHS.includes(item.href)) {
        return null;
      }
    }
    
    // Hide permissions link if user doesn't have access
    if (item.href === "/cms/permissions" && !canAccessPermissions) {
      return null;
    }

    if (item.href === "/cms/availability" && userRole !== "admin") {
      return null;
    }

    if (item.href === "/cms/approvals" && userRole !== "admin" && userRole !== SECURITY_ROLE && userRole !== "staff") {
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