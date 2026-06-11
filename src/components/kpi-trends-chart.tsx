"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export type TrendSeries = {
  label: string;
  accent: string;
  change: string;
  caption: string;
  values: number[];
};

export function KpiTrendsChart({
  chartData,
  trendSeries,
}: {
  chartData: Record<string, string | number>[];
  trendSeries: TrendSeries[];
}) {
  if (chartData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No data available for the last 7 days.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              stroke="hsl(var(--muted-foreground))"
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "13px",
              }}
            />
            {trendSeries.map((s) => (
              <Bar
                key={s.label}
                dataKey={s.label}
                fill={s.accent}
                radius={[4, 4, 0, 0]}
                maxBarSize={24}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {trendSeries.map((s) => (
          <div key={s.label} className="rounded-lg border border-border/60 p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.accent }} />
              <p className="text-xs font-medium">{s.label}</p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">{s.caption}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
