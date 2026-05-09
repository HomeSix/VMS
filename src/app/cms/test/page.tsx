"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TestPage() {
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          setLoading(false);
          return;
        }

        const name =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split("@")[0] ||
          "User";
        setUserName(name);

        const { data: userData, error: roleError } = await supabase
          .from("system_user")
          .select("role_id, is_active")
          .eq("id", user.id)
          .maybeSingle();

        if (!roleError && userData) {
          let roleName = "";
          if (userData.role_id) {
            const { data: roleInfo } = await supabase
              .from("roles")
              .select("name")
              .eq("id", userData.role_id)
              .maybeSingle();
            roleName = roleInfo?.name ?? "";
          }
          setUserRole(roleName);

          // Check if user has permission for /cms/test
          if (roleName === "admin") {
            setHasPermission(true);
          } else if (userData.role_id) {
            const { data: perm } = await supabase
              .from("role_permissions")
              .select("can_access")
              .eq("role_id", userData.role_id)
              .eq("page_path", "/cms/test")
              .maybeSingle();
            setHasPermission(perm?.can_access || false);
          } else {
            setHasPermission(false);
          }
        } else {
          setUserRole("");
          setHasPermission(false);
        }
      } catch (error) {
        console.error("Error checking permissions:", error);
        setUserRole("");
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    };

    checkPermissions();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Permission Test Page</CardTitle>
          <CardDescription>
            This page is used to test if role-based permissions are working correctly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">User Information</h3>
              <p><strong>Name:</strong> {userName}</p>
              <p><strong>Role:</strong> {userRole || "No role"}</p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Permission Status</h3>
              <p className={`text-lg font-medium ${hasPermission ? "text-green-600" : "text-red-600"}`}>
                {hasPermission ? "✅ Has Access" : "❌ No Access"}
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Page Path</h3>
              <p className="font-mono text-sm bg-muted p-2 rounded">
                /cms/test
              </p>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h3 className="font-semibold mb-2">Testing Instructions</h3>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Go to admin account and grant your role permission for "/cms/test" page</li>
              <li>Log out and log back in with your staff account</li>
              <li>Navigate to this test page to verify access</li>
              <li>The "Permission Status" should show "✅ Has Access" if permissions are working</li>
              <li>Try removing the permission and verify you get "❌ No Access"</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
