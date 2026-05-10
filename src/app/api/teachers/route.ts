import { NextResponse } from "next/server"

import { createClient } from "@/lib/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("system_user")
    .select("id, full_name")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  if (error) {
    return NextResponse.json({ teachers: [], error: error.message }, { status: 500 })
  }

  const teachers = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      fullName: String(row.full_name ?? "").trim(),
    }))
    .filter((row) => row.fullName.length > 0)

  return NextResponse.json({ teachers })
}
