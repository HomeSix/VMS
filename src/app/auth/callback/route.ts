import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_callback_failed`
    );
  }

  const cookieStore = await cookies();
  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: any;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (newCookies) => {
          newCookies.forEach(({ name, value, options }) => {
            cookiesToSet.push({ name, value, options });
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_callback_failed`
    );
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData?.user;

  if (userError || !user) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=auth_callback_failed`
    );
  }

  const PENDING_STATUS = "pending";
  let role = "pending";
  let status = PENDING_STATUS;

  const { data: existing, error: lookupError } = await supabase
    .from("system_user")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!lookupError && existing) {
    role = existing.role ?? role;
    status = existing.status ?? status;
  } else if (!existing && !lookupError) {
    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split("@")[0] ||
      "User";
    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      user.identities?.[0]?.identity_data?.avatar_url ||
      user.identities?.[0]?.identity_data?.picture ||
      null;

    const { data: inserted, error: insertError } = await supabase
      .from("system_user")
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role: "pending",
        status: PENDING_STATUS,
      })
      .select("role, status")
      .single();

    if (!insertError) {
      role = inserted?.role ?? role;
      status = inserted?.status ?? status;
    }
  }

  const target = "/cms/dashboard";
  const response = NextResponse.redirect(new URL(target, origin));

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  return response;
}