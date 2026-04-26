import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const config = {
  matcher: ["/cms/:path*"],
};

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
  const isCmsLogin = pathname === "/cms/login";

  if (!session && !isCmsLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms/login";
    return NextResponse.redirect(url);
  }

  if (session && isCmsLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/cms/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
