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

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (newCookies) => {
          newCookies.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
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

  let role = "pending";
  let isActive = false;

  const { data: existing, error: lookupError } = await supabase
    .from("system_user")
    .select("role_id, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!lookupError && existing) {
    if (existing.role_id) {
      const { data: roleInfo } = await supabase
        .from("roles")
        .select("name")
        .eq("id", existing.role_id)
        .maybeSingle();
      role = roleInfo?.name ?? role;
    }
    isActive = existing.is_active ?? isActive;
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

    const { data: pendingRole } = await supabase
      .from("roles")
      .select("id")
      .eq("name", "pending")
      .maybeSingle();

    const { data: inserted, error: insertError } = await supabase
      .from("system_user")
      .insert({
        id: user.id,
        email: user.email,
        full_name: fullName,
        avatar_url: avatarUrl,
        role_id: pendingRole?.id ?? null,
        is_active: false,
      })
      .select("role_id, is_active")
      .single();

    if (!insertError && inserted) {
      if (inserted.role_id) {
        const { data: roleInfo } = await supabase
          .from("roles")
          .select("name")
          .eq("id", inserted.role_id)
          .maybeSingle();
        role = roleInfo?.name ?? role;
      }
      isActive = inserted.is_active ?? isActive;
    }
  }

  const target = "/cms/dashboard";
  return NextResponse.redirect(new URL(target, origin));
}