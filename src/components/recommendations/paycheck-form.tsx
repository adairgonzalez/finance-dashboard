"use client";

import { useState } from "react";
import { PaycheckInput } from "@/types/recommendation";
import { DollarSign } from "lucide-react";

interface PaycheckFormProps {
  onSubmit: (input: PaycheckInput) => void;
  isLoading: boolean;
}

export function PaycheckForm({ onSubmit, isLoading }: PaycheckFormProps) {
  const nextPayDefault = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  };

  const [amount, setAmount] = useState("3200");
  const [frequency, setFrequency] = useState<PaycheckInput["frequency"]>("biweekly");
  const [nextPayDate, setNextPayDate] = useState(nextPayDefault());
  const [fixedExpenses, setFixedExpenses] = useState("1800");
  const [savingsGoalPercent, setSavingsGoalPercent] = useState(15);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      amount: parseFloat(amount),
      frequency,
      nextPayDate,
      fixedExpenses: parseFloat(fixedExpenses),
      savingsGoalPercent,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Paycheck Amount (after tax)
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="3200"
            min="0"
            step="0.01"
            required
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Pay Frequency
        </label>
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as PaycheckInput["frequency"])}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="biweekly">Biweekly (every 2 weeks)</option>
          <option value="semimonthly">Semi-monthly (1st & 15th)</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Next Pay Date
        </label>
        <input
          type="date"
          value={nextPayDate}
          onChange={(e) => setNextPayDate(e.target.value)}
          className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Fixed Monthly Expenses
        </label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="number"
            value={fixedExpenses}
            onChange={(e) => setFixedExpenses(e.target.value)}
            className="w-full rounded-lg border border-input bg-background pl-9 pr-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="1800"
            min="0"
            step="0.01"
            required
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Rent, utilities, subscriptions, insurance, etc.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-1.5 block">
          Savings Goal: {savingsGoalPercent}%
        </label>
        <input
          type="range"
          min="0"
          max="30"
          value={savingsGoalPercent}
          onChange={(e) => setSavingsGoalPercent(parseInt(e.target.value))}
          className="w-full accent-primary"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0%</span>
          <span>30%</span>
        </div>
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isLoading ? "Calculating..." : "Calculate Allocation"}
      </button>
    </form>
  );
}
