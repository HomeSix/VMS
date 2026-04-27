import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/cms/:path*"],
};

const ADMIN_ROLE = "admin";
const APPROVED_STATUS = "approved";

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
      },
    }
  );

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const pathname = request.nextUrl.pathname;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  const { data: roleData } = await supabase
    .from("system_user")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  const role = roleData?.role ?? "";
  const status = roleData?.status ?? "pending";
  const isStaffApprovals = pathname === "/cms/staff-approvals";
  const isApproved = role === ADMIN_ROLE || status === APPROVED_STATUS;

  if (!isApproved && !isStaffApprovals) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms/staff-approvals";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
