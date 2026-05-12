import * as React from "react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  desc: string
  accent?: "emerald" | "sky" | "violet" | "amber" | "rose" | "indigo"
  className?: string
}

const accentMap: Record<string, { strip: string; value: string }> = {
  emerald: { strip: "bg-emerald-500", value: "text-emerald-600" },
  sky: { strip: "bg-sky-500", value: "text-sky-600" },
  violet: { strip: "bg-violet-500", value: "text-violet-600" },
  amber: { strip: "bg-amber-500", value: "text-amber-600" },
  rose: { strip: "bg-rose-500", value: "text-rose-600" },
  indigo: { strip: "bg-indigo-500", value: "text-indigo-600" },
};

export function StatCard({ title, value, desc, accent, className }: StatCardProps) {
  const colors = accent ? accentMap[accent] : null;
  return (
    <div
      className={cn(
        "rounded-xl border bg-card text-card-foreground shadow-xs hover:shadow-md hover:border-foreground/20 transition-all duration-200 ease-in-out hover:-translate-y-0.5 cursor-default relative overflow-hidden",
        className
      )}
    >
      {colors && (
        <div className={`absolute top-0 left-0 right-0 h-1 ${colors.strip}/60`} />
      )}
      <div className="flex flex-col space-y-2 p-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className={cn("text-2xl font-bold", colors?.value)}>{value}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
