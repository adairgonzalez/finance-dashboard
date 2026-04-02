"use client";

import { AllocationResult } from "@/types/recommendation";
import { formatCurrency } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export function AllocationChart({ result }: { result: AllocationResult }) {
  const data = result.items.map((item) => ({
    name: item.category.length > 20 ? item.category.slice(0, 18) + "…" : item.category,
    amount: item.amount,
    color: item.color,
    fullName: item.category,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground mb-4">
        Paycheck Allocation Breakdown
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => `$${v}`}
              tick={{ fontSize: 11, fill: "hsl(215.4, 16.3%, 46.9%)" }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11, fill: "hsl(215.4, 16.3%, 46.9%)" }}
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelFormatter={(_, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return "";
              }}
              contentStyle={{
                background: "hsl(0, 0%, 100%)",
                border: "1px solid hsl(214.3, 31.8%, 91.4%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={24}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
