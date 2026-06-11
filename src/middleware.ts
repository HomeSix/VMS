import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isElevated, isSecurityRole, isStaffRole } from "@/lib/roles";

export const config = {
  matcher: ["/cms/:path*"],
};

const APPROVED_STATUS = true;

// Normalize paths for consistent comparison
// Handles both "/cms/permissions" and "permissions" formats
function normalizePath(path: string): string {
  // Remove leading /cms/ or cms/ prefix if present
  return path.replace(/^\/cms\//, "").replace(/^cms\//, "");
}

// Full path with /cms/ prefix
function fullPath(path: string): string {
  if (path.startsWith("/cms/")) return path;
  if (path.startsWith("/")) return `/cms${path}`;
  return `/cms/${path}`;
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next();
  
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const pathname = request.nextUrl.pathname;

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  const { data: userRoleData, error: userRoleError } = await supabase
    .from("system_user")
    .select("role_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  let roleName = "";
  if (userRoleData?.role_id) {
    const { data: roleInfo, error: roleError } = await supabase
      .from("roles")
      .select("name")
      .eq("id", userRoleData.role_id)
      .maybeSingle();
    
    if (roleError) {
      console.error("Role fetch error:", roleError);
    }
    
    roleName = roleInfo?.name ?? "";
  }

  const isDashboard = pathname === "/cms/dashboard";
  const isPermissions = pathname === "/cms/permissions";
  const isDenied = pathname === "/cms/denied";
  const isApprovals = pathname === "/cms/approvals";
  const isAdmin = isElevated(roleName);
  const isApproved = isAdmin || userRoleData?.is_active === APPROVED_STATUS;

  // Always allow the denied page
  if (isDenied) {
    return NextResponse.next();
  }

  // Unapproved users only see dashboard (and denied)
  if (!isApproved && !isDashboard) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms/dashboard";
    return NextResponse.redirect(url);
  }

  // Admin bypasses all permission checks
  if (isAdmin) {
    return NextResponse.next();
  }

  // Unapproved users — only dashboard
  if (!isApproved) {
    if (isDashboard) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/cms/dashboard";
    return NextResponse.redirect(url);
  }

  const roleId = userRoleData?.role_id;

  // Check role_permissions for all approved non-admin users
  if (roleId) {
    let { data: perm, error: permError } = await supabase
      .from("role_permissions")
      .select("can_access")
      .eq("role_id", roleId)
      .eq("page_path", pathname)
      .maybeSingle();

    if (!perm && !permError) {
      const normalized = normalizePath(pathname);
      const result = await supabase
        .from("role_permissions")
        .select("can_access")
        .eq("role_id", roleId)
        .eq("page_path", normalized)
        .maybeSingle();
      perm = result.data;
      permError = result.error;
    }

    if (permError) {
      console.error("Permission fetch error:", permError);
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
    }

    // Explicit permission record found — respect it
    if (perm !== null && perm !== undefined) {
      if (perm.can_access) return NextResponse.next();
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
    }
  }

  // No explicit permission — fall back to role-based defaults
  if (isStaffRole(roleName) || isSecurityRole(roleName)) {
    if (isDashboard || isApprovals) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/cms/denied";
    return NextResponse.redirect(url);
  }

  // Other approved roles — dashboard allowed by default
  if (isDashboard) return NextResponse.next();

  // Everything else denied
  const url = request.nextUrl.clone();
  url.pathname = "/cms/denied";
  return NextResponse.redirect(url);
}