"use client";

import { AllocationResult } from "@/types/recommendation";
import { formatCurrency } from "@/lib/utils";

export function AllocationTable({ result }: { result: AllocationResult }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">
          Detailed Allocation
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                #
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                Category
              </th>
              <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                Amount
              </th>
              <th className="text-left px-5 py-3 font-medium text-muted-foreground hidden sm:table-cell">
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((item) => (
              <tr
                key={item.priority}
                className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
              >
                <td className="px-5 py-3 text-muted-foreground">
                  {item.priority}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-foreground">
                      {item.category}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3 text-right font-semibold text-foreground">
                  {formatCurrency(item.amount)}
                </td>
                <td className="px-5 py-3 text-muted-foreground text-xs hidden sm:table-cell">
                  {item.reason}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-secondary/50">
              <td colSpan={2} className="px-5 py-3 font-semibold text-foreground">
                Total
              </td>
              <td className="px-5 py-3 text-right font-bold text-foreground">
                {formatCurrency(result.totalAllocated)}
              </td>
              <td className="hidden sm:table-cell" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
