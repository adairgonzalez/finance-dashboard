"use client";

import { useState } from "react";
import { CreditCardAccount } from "@/types/account";
import { formatCurrency, daysUntil } from "@/lib/utils";
import { CreditCard, Calendar, AlertTriangle, Pencil, Check, X } from "lucide-react";

interface AccountCardProps {
  account: CreditCardAccount;
  onBalanceUpdate?: () => void;
}

export function AccountCard({ account, onBalanceUpdate }: AccountCardProps) {
  const [editing, setEditing] = useState(false);
  const [editBalance, setEditBalance] = useState(account.currentBalance.toString());
  const [editLimit, setEditLimit] = useState(account.creditLimit.toString());
  const [saving, setSaving] = useState(false);

  const utilization = account.currentBalance / account.creditLimit;
  const utilizationPct = (utilization * 100).toFixed(1);
  const dueDays = daysUntil(account.paymentDueDate);

  const utilizationColor =
    utilization > 0.5 ? "bg-red-500" : utilization > 0.3 ? "bg-yellow-500" : "bg-green-500";
  const dueUrgent = dueDays <= 5;

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch("/api/accounts/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          currentBalance: parseFloat(editBalance) || 0,
          creditLimit: parseFloat(editLimit) || 0,
        }),
      });
      setEditing(false);
      onBalanceUpdate?.();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

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
        <div className="flex items-center gap-1">
          {!editing && (
            <button
              onClick={() => {
                setEditBalance(account.currentBalance.toString());
                setEditLimit(account.creditLimit.toString());
                setEditing(true);
              }}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Edit balance"
            >
              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <CreditCard className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        {editing ? (
          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground">Balance</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editBalance}
                  onChange={(e) => setEditBalance(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-lg font-bold text-foreground"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Credit Limit</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <input
                  type="number"
                  step="0.01"
                  value={editLimit}
                  onChange={(e) => setEditLimit(e.target.value)}
                  className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 rounded bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-3 w-3" />
                Save
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex items-center gap-1 rounded border border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
              >
                <X className="h-3 w-3" />
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-1">Current Balance</p>
            <p className={`text-2xl font-bold ${utilization > 0.5 ? "text-red-600" : "text-foreground"}`}>
              {formatCurrency(account.currentBalance)}
            </p>
          </>
        )}
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
