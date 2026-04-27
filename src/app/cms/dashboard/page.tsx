import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { StatCard } from "@/components/ui/stat-card";

export const dynamic = 'force-dynamic';

async function getAuthenticatedUser() {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
            cookies: {
                getAll: () => cookieStore.getAll(),
            },
        }
    );

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return data.user;
}



export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Users" value="1,248" desc="+12% this week" />
        <StatCard title="Revenue" value="RM 32,450" desc="+8% this month" />
        <StatCard title="Active Projects" value="23" desc="3 new added" />
      </div>

      {/* Main panels */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">Recent Activity</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your system is running smoothly. No critical alerts.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <h2 className="font-semibold">System Overview</h2>
          <p className="text-sm text-muted-foreground mt-2">
            CPU, memory, and API status will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}