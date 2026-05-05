"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CmsLoginPage() {
  const router = useRouter();

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

      router.push("/cms/dashboard");
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
    <div 
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4"
      style={{ backgroundImage: "url('/login-background.jpg')" }}
    >
      {/* KEY FIX: p-0 removes Card's default padding so children can fill edge-to-edge */}
      <Card className="w-full max-w-4xl shadow-2xl border-0 overflow-hidden p-0" style={{ borderRadius: "0 !important" }}>
        <div className="flex flex-col lg:flex-row min-h-[520px]">

          {/* Left side - School Badge */}
          {/* KEY FIX: removed rounded-l-3xl — parent's overflow-hidden + rounded-3xl handles clipping */}
          <div className="lg:w-1/2 bg-sidebar flex flex-col items-center justify-center p-12 text-sidebar-foreground">
            <div className="text-center space-y-6">
              <img
                src="/lencana_sekolah.png"
                alt="School Badge"
                className="w-32 h-auto object-contain mx-auto"
              />
              <div className="space-y-2">
                <h1 className="text-3xl font-bold">SK SERI TELOK</h1>
                <h1 className="text-3xl font-bold">PARIT YAANI</h1>
              </div>
              <p className="text-sidebar-accent-foreground text-sm max-w-xs mx-auto">
                Visitor Management System
              </p>
            </div>
          </div>

          {/* Right side - Login Form */}
          <div className="lg:w-1/2 bg-card p-12">
            <div className="max-w-sm mx-auto">
              <CardHeader className="p-0 mb-8">
                <CardTitle className="text-2xl font-bold text-card-foreground">
                  Login
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Enter your credentials to access the system
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                <form onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="email" className="text-card-foreground">
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="m@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="bg-background"
                      />
                    </div>

                    <div className="grid gap-2">
                      <div className="flex items-center">
                        <Label htmlFor="password" className="text-card-foreground">
                          Password
                        </Label>
                        <a
                          href="#"
                          className="ml-auto inline-block text-sm underline-offset-4 hover:underline text-muted-foreground"
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
                        className="bg-background"
                      />
                    </div>

                    {error && (
                      <p className="text-sm text-destructive font-medium">
                        {error}
                      </p>
                    )}
                  </div>

                  <div className="flex-col gap-4 mt-8">
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Logging in..." : "Login"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full mt-3"
                      onClick={handleGoogleLogin}
                      disabled={loading}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        width="20"
                        height="20"
                        fill="#000000"
                        style={{ opacity: 1 }}
                      >
                        <path d="M12 2a9.96 9.96 0 0 1 6.29 2.226a1 1 0 0 1 .04 1.52l-1.51 1.362a1 1 0 0 1-1.265.06a6 6 0 1 0 2.103 6.836l.001-.004h-3.66a1 1 0 0 1-.992-.883L13 13v-2a1 1 0 0 1 1-1h6.945a1 1 0 0 1 .994.89q.06.55.061 1.11c0 5.523-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2" />
                      </svg>
                      <span className="ml-2">Login with Google</span>
                    </Button>
                  </div>

                  <button
                    onClick={() => (window.location.href = "/")}
                    className="mx-auto block text-sm text-center mt-6 text-muted-foreground hover:text-card-foreground hover:underline transition"
                  >
                    Are you a visitor? Click here.
                  </button>
                </form>
              </CardContent>
            </div>
          </div>

        </div>
      </Card>
    </div>
  );
}