"use client";

import { useState, useEffect } from "react";
import { AccountList } from "@/components/accounts/account-list";
import { CreditCardAccount } from "@/types/account";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, TrendingDown, CreditCard, AlertCircle } from "lucide-react";

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<CreditCardAccount[]>([]);

  useEffect(() => {
    fetch("/api/accounts")
      .then(async (r) => {
        const text = await r.text();
        if (!r.ok) {
          throw new Error(text || `Failed to fetch accounts (${r.status})`);
        }
        return text ? JSON.parse(text) : [];
      })
      .then(setAccounts)
      .catch((err) => {
        console.error("Failed to load dashboard accounts:", err);
      });
  }, []);

  const totalDebt = accounts.reduce((s, a) => s + a.currentBalance, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.creditLimit, 0);
  const totalAvailable = accounts.reduce((s, a) => s + a.availableCredit, 0);
  const totalMinPayments = accounts.reduce((s, a) => s + a.minimumPayment, 0);
  const utilization = totalCredit > 0 ? (totalDebt / totalCredit) * 100 : 0;

  const stats = [
    {
      label: "Total Debt",
      value: formatCurrency(totalDebt),
      icon: DollarSign,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Available Credit",
      value: formatCurrency(totalAvailable),
      icon: CreditCard,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Utilization",
      value: `${utilization.toFixed(1)}%`,
      icon: TrendingDown,
      color: utilization > 30 ? "text-yellow-600" : "text-green-600",
      bg: utilization > 30 ? "bg-yellow-50" : "bg-green-50",
    },
    {
      label: "Min Payments Due",
      value: formatCurrency(totalMinPayments),
      icon: AlertCircle,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Financial Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time overview of your credit card accounts
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`rounded-lg p-2 ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Account cards */}
      <AccountList />
    </div>
  );
}
