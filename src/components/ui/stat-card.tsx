import * as React from "react"

import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: string
  desc: string
  className?: string
}

export function StatCard({ title, value, desc, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-6 text-card-foreground shadow-xs",
        className
      )}
    >
      <div className="flex flex-col space-y-2">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}
