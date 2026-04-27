"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CmsLoginPage() {
  const router = useRouter();

  const ADMIN_ROLE = "admin";
  const APPROVED_STATUS = "approved";
  const PENDING_STATUS = "pending";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ensureUserStatus = async (
    supabase: ReturnType<typeof createClient>
  ) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("Unable to verify your account. Please try again.");
    }

    const { data: existing, error: lookupError } = await supabase
      .from("system_user")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();

    if (lookupError) {
      throw new Error("Unable to verify your access. Please try again.");
    }

    if (!existing) {
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

      if (insertError) {
        throw new Error("Unable to register your account. Please try again.");
      }

      return {
        role: inserted?.role ?? "pending",
        status: inserted?.status ?? PENDING_STATUS,
      };
    }

    return {
      role: existing.role ?? "pending",
      status: existing.status ?? PENDING_STATUS,
    };
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    try {
      const { role, status } = await ensureUserStatus(supabase);
      setLoading(false);

      if (role === ADMIN_ROLE || status === APPROVED_STATUS) {
        router.push("/cms/dashboard");
      } else {
        router.push("/cms/staff-approvals");
      }
    } catch (roleError) {
      setLoading(false);
      setError(
        roleError instanceof Error
          ? roleError.message
          : "Unable to verify your account."
      );
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data?.url) {
      window.location.assign(data.url);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 px-4">
      <Card className="w-full max-w-sm shadow-2xl border-0 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>
            Enter your email below to login to your account
          </CardDescription>
          <CardAction>
            <Button variant="link">Help</Button>
          </CardAction>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="m@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password">Password</Label>
                  <a
                    href="#"
                    className="ml-auto inline-block text-sm underline-offset-4 hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>

                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
            </div>

            <CardFooter className="flex-col gap-2 px-0 pt-6">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogleLogin}
                disabled={loading}
              >

                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#000000" style={{ opacity: 1 }}><path  d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1-1.265.06a6 6 0 1 0 2.103 6.836l.001-.004h-3.66a1 1 0 0 1-.992-.883L13 13v-2a1 1 0 0 1 1-1h6.945a1 1 0 0 1 .994.89q.06.55.061 1.11c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2"/></svg>
                Login with Google
              </Button>
            </CardFooter>
           <button
            onClick={() => window.location.href = '/'}
            className="mx-auto block text-sm text-center mt-4 text-grey-600 hover:text-grey-800 hover:underline transition"
            style={{ fontSize: 12, fontFamily: "'Inter', sans-serif" }}
          >
            Are you a visitor? Click here.
          </button>

          </form>
        </CardContent>
      </Card>
    </div>
  );
}