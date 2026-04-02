"use client";

import { CreditCardAccount } from "@/types/account";
import { formatCurrency, daysUntil } from "@/lib/utils";
import { CreditCard, Calendar, AlertTriangle } from "lucide-react";

export function AccountCard({ account }: { account: CreditCardAccount }) {
  const utilization = account.currentBalance / account.creditLimit;
  const utilizationPct = (utilization * 100).toFixed(1);
  const dueDays = daysUntil(account.paymentDueDate);

  const utilizationColor =
    utilization > 0.5 ? "bg-red-500" : utilization > 0.3 ? "bg-yellow-500" : "bg-green-500";
  const dueUrgent = dueDays <= 5;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: account.color }}
          >
            {account.institution[0]}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground leading-tight">
              {account.name}
            </h3>
            <p className="text-xs text-muted-foreground">
              ****{account.last4}
            </p>
          </div>
        </div>
        <CreditCard className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
        <p className={`text-2xl font-bold ${utilization > 0.5 ? "text-red-600" : "text-foreground"}`}>
          {formatCurrency(account.currentBalance)}
        </p>
      </div>

      {/* Utilization bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{utilizationPct}% used</span>
          <span>{formatCurrency(account.availableCredit)} available</span>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilizationColor}`}
            style={{ width: `${Math.min(utilization * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Details row */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Due Date</span>
          </div>
          <p className={`text-sm font-medium ${dueUrgent ? "text-red-600" : "text-foreground"}`}>
            {dueUrgent && <AlertTriangle className="h-3 w-3 inline mr-1" />}
            {dueDays <= 0 ? "Overdue!" : `${dueDays} days`}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Min Payment</p>
          <p className="text-sm font-medium text-foreground">
            {formatCurrency(account.minimumPayment)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">APR</p>
          <p className="text-sm font-medium text-foreground">
            {(account.apr * 100).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Last Payment</p>
          <p className="text-sm font-medium text-foreground">
            {formatCurrency(account.lastPaymentAmount)}
          </p>
        </div>
      </div>
    </div>
  );
}
