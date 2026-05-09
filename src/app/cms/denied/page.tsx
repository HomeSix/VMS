"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldX } from "lucide-react";

export default function DeniedPage() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-2">
            <ShieldX className="h-10 w-10 text-destructive" />
          </div>
          <CardTitle className="text-xl">Access denied</CardTitle>
          <CardDescription>
            Your role does not have permission to view this page.
            Contact an administrator if you believe this is an error.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => router.push("/cms/dashboard")}>
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
