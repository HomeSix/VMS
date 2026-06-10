import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/cms/:path*"],
};

const ADMIN_ROLE = "admin";
const SECURITY_ROLE = "security";
const STAFF_ROLE = "staff";
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
  const isAdmin = roleName === ADMIN_ROLE;
  const isSecurity = roleName === SECURITY_ROLE;
  const isStaff = roleName === STAFF_ROLE;
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

  // Security role: only dashboard + approvals
  if (isSecurity) {
    if (isDashboard || isApprovals) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/cms/denied";
    return NextResponse.redirect(url);
  }

  // Staff role: allow dashboard + approvals
  if (isStaff) {
    if (isDashboard || isApprovals) {
      return NextResponse.next();
    }
    const url = request.nextUrl.clone();
    url.pathname = "/cms/denied";
    return NextResponse.redirect(url);
  }

  // Role-based page permission check for non-admin approved users
  if (isApproved && !isDashboard) {
    const roleId = userRoleData?.role_id;
    
    if (!roleId) {
      // No role assigned — deny everything except dashboard
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
    }

    // Try matching with full path first (e.g., "/cms/permissions")
    let { data: perm, error: permError } = await supabase
      .from("role_permissions")
      .select("can_access")
      .eq("role_id", roleId)
      .eq("page_path", pathname)
      .maybeSingle();

    // If no match, try with normalized path (e.g., "permissions")
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

    // Debug logging (uncomment to troubleshoot)
    // console.log({
    //   pathname,
    //   normalizedPath: normalizePath(pathname),
    //   roleId,
    //   roleName,
    //   perm,
    //   permError,
    //   userRoleData,
    // });

    if (permError) {
      console.error("Permission fetch error:", permError);
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
    }

    // Explicit deny
    if (perm && perm.can_access === false) {
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
    }

    // No permission record found — configurable behavior
    if (!perm) {
      // Option 1: Deny by default (strict)
      const url = request.nextUrl.clone();
      url.pathname = "/cms/denied";
      return NextResponse.redirect(url);
      
      // Option 2: Allow by default (permissive) — uncomment below, comment out above
      // return NextResponse.next();
    }
  }

  return NextResponse.next();
}