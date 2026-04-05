"use client";

import { useState, useEffect } from "react";
import { Bill } from "@/types/bill";
import { formatCurrency } from "@/lib/utils";
import {
  Receipt,
  Plus,
  Trash2,
  Pencil,
  DollarSign,
  Save,
  X,
  Wallet,
} from "lucide-react";

const BILL_CATEGORIES: { value: Bill["category"]; label: string }[] = [
  { value: "housing", label: "Housing" },
  { value: "utilities", label: "Utilities" },
  { value: "insurance", label: "Insurance" },
  { value: "subscriptions", label: "Subscriptions" },
  { value: "loans", label: "Loans" },
  { value: "other", label: "Other" },
];

const CATEGORY_COLORS: Record<Bill["category"], string> = {
  housing: "#ef4444",
  utilities: "#f59e0b",
  insurance: "#3b82f6",
  subscriptions: "#8b5cf6",
  loans: "#ec4899",
  other: "#6b7280",
};

interface ProfileState {
  monthlyPaycheck: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [profile, setProfile] = useState<ProfileState>({
    monthlyPaycheck: 0,
    payFrequency: "biweekly",
  });
  const [editingBill, setEditingBill] = useState<Partial<Bill> | null>(null);
  const [editingPaycheck, setEditingPaycheck] = useState(false);
  const [paycheckDraft, setPaycheckDraft] = useState("");
  const [freqDraft, setFreqDraft] = useState<ProfileState["payFrequency"]>("biweekly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/bills").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([b, p]) => {
        if (Array.isArray(b)) setBills(b);
        if (p && typeof p.monthlyPaycheck === "number") {
          setProfile(p);
          setPaycheckDraft(String(p.monthlyPaycheck || ""));
          setFreqDraft(p.payFrequency || "biweekly");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveBill = async (bill: Partial<Bill>) => {
    const full: Bill = {
      id: bill.id || crypto.randomUUID(),
      name: bill.name || "",
      amount: bill.amount || 0,
      dueDay: bill.dueDay || 1,
      category: bill.category || "other",
      isAutoPay: bill.isAutoPay || false,
    };

    const res = await fetch("/api/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(full),
    });
    const updated = await res.json();
    if (Array.isArray(updated)) setBills(updated);
    setEditingBill(null);
  };

  const deleteBill = async (id: string) => {
    const res = await fetch("/api/bills", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const updated = await res.json();
    if (Array.isArray(updated)) setBills(updated);
  };

  const savePaycheck = async () => {
    const val = parseFloat(paycheckDraft);
    if (isNaN(val) || val < 0) return;
    const updated = { monthlyPaycheck: val, payFrequency: freqDraft };
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setProfile(updated);
    setEditingPaycheck(false);
  };

  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const afterBills = profile.monthlyPaycheck - totalBills;

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-card animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Receipt className="h-6 w-6" />
          Bills & Income
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your monthly bills and paycheck to get better financial insights
        </p>
      </div>

      {/* Income + Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Monthly Paycheck */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-green-50 p-2">
                <Wallet className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs text-muted-foreground">Monthly Income</span>
            </div>
            {!editingPaycheck && (
              <button
                onClick={() => {
                  setPaycheckDraft(String(profile.monthlyPaycheck || ""));
                  setFreqDraft(profile.payFrequency);
                  setEditingPaycheck(true);
                }}
                className="p-1 rounded hover:bg-accent"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          {editingPaycheck ? (
            <div className="space-y-2">
              <div className="relative">
                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="number"
                  value={paycheckDraft}
                  onChange={(e) => setPaycheckDraft(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0"
                  autoFocus
                />
              </div>
              <select
                value={freqDraft}
                onChange={(e) => setFreqDraft(e.target.value as ProfileState["payFrequency"])}
                className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="semimonthly">Semi-monthly</option>
                <option value="monthly">Monthly</option>
              </select>
              <div className="flex gap-1">
                <button
                  onClick={savePaycheck}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-primary text-primary-foreground px-2 py-1.5 text-xs hover:bg-primary/90"
                >
                  <Save className="h-3 w-3" /> Save
                </button>
                <button
                  onClick={() => setEditingPaycheck(false)}
                  className="rounded-lg border border-border px-2 py-1.5 text-xs hover:bg-accent"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-xl font-bold text-green-600">
                {profile.monthlyPaycheck > 0
                  ? formatCurrency(profile.monthlyPaycheck)
                  : "Not set"}
              </p>
              {profile.monthlyPaycheck > 0 && (
                <p className="text-xs text-muted-foreground capitalize">
                  {profile.payFrequency}
                </p>
              )}
            </>
          )}
        </div>

        {/* Total Bills */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="rounded-lg bg-red-50 p-2">
              <Receipt className="h-4 w-4 text-red-600" />
            </div>
            <span className="text-xs text-muted-foreground">Total Bills</span>
          </div>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(totalBills)}
          </p>
          <p className="text-xs text-muted-foreground">
            {bills.length} bill{bills.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* After Bills */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`rounded-lg p-2 ${afterBills >= 0 ? "bg-blue-50" : "bg-yellow-50"}`}>
              <DollarSign className={`h-4 w-4 ${afterBills >= 0 ? "text-blue-600" : "text-yellow-600"}`} />
            </div>
            <span className="text-xs text-muted-foreground">After Bills</span>
          </div>
          <p className={`text-xl font-bold ${afterBills >= 0 ? "text-blue-600" : "text-yellow-600"}`}>
            {profile.monthlyPaycheck > 0
              ? formatCurrency(afterBills)
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">
            Available for debt & savings
          </p>
        </div>
      </div>

      {/* Bills List */}
      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Monthly Bills</h2>
          <button
            onClick={() =>
              setEditingBill({
                name: "",
                amount: 0,
                dueDay: 1,
                category: "other",
                isAutoPay: false,
              })
            }
            className="flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Bill
          </button>
        </div>

        {/* Add/Edit Form */}
        {editingBill && (
          <div className="px-5 py-4 border-b border-border bg-secondary/30">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Name
                </label>
                <input
                  type="text"
                  value={editingBill.name || ""}
                  onChange={(e) =>
                    setEditingBill({ ...editingBill, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="e.g. Rent"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="number"
                    value={editingBill.amount || ""}
                    onChange={(e) =>
                      setEditingBill({
                        ...editingBill,
                        amount: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded-lg border border-input bg-background pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Due Day
                </label>
                <input
                  type="number"
                  value={editingBill.dueDay || ""}
                  onChange={(e) =>
                    setEditingBill({
                      ...editingBill,
                      dueDay: Math.min(31, Math.max(1, parseInt(e.target.value) || 1)),
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  min="1"
                  max="31"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Category
                </label>
                <select
                  value={editingBill.category || "other"}
                  onChange={(e) =>
                    setEditingBill({
                      ...editingBill,
                      category: e.target.value as Bill["category"],
                    })
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {BILL_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-between mt-3">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={editingBill.isAutoPay || false}
                  onChange={(e) =>
                    setEditingBill({ ...editingBill, isAutoPay: e.target.checked })
                  }
                  className="rounded border-input accent-primary"
                />
                Auto-pay enabled
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingBill(null)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => editingBill.name && saveBill(editingBill)}
                  disabled={!editingBill.name}
                  className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {editingBill.id ? "Update" : "Add"} Bill
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bill rows */}
        {bills.length === 0 && !editingBill ? (
          <div className="px-5 py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No bills added yet. Click &quot;Add Bill&quot; to start tracking your monthly expenses.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bills
              .sort((a, b) => a.dueDay - b.dueDay)
              .map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-accent/50 transition-colors"
                >
                  <div
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{ backgroundColor: CATEGORY_COLORS[bill.category] }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-foreground truncate">
                        {bill.name}
                      </span>
                      {bill.isAutoPay && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">
                          Auto
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground capitalize">
                      {bill.category} &middot; Due {bill.dueDay === 1 ? "1st" : bill.dueDay === 2 ? "2nd" : bill.dueDay === 3 ? "3rd" : `${bill.dueDay}th`}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatCurrency(bill.amount)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingBill(bill)}
                      className="p-1.5 rounded hover:bg-accent"
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="p-1.5 rounded hover:bg-accent"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
