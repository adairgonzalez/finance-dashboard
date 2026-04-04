"use client";

import { useState, useEffect } from "react";
import { CreditCardAccount } from "@/types/account";
import { AccountCard } from "./account-card";
import { PlaidLinkButton } from "./plaid-link-button";
import { RefreshCw, Trash2 } from "lucide-react";

export function AccountList() {
  const [accounts, setAccounts] = useState<CreditCardAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchAccounts = async () => {
    try {
      const res = await fetch("/api/accounts");
      const data = await res.json();
      setAccounts(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
    const interval = setInterval(fetchAccounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleRemoveAccounts = async () => {
    setRemoving(true);
    try {
      await fetch("/api/accounts", { method: "DELETE" });
      await fetchAccounts();
    } catch (err) {
      console.error("Failed to remove accounts:", err);
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-64 rounded-xl border border-border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Credit Card Accounts
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRemoveAccounts}
            disabled={removing}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent disabled:opacity-50"
            title="Remove all accounts"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {removing ? "Removing..." : "Remove Accounts"}
          </button>
          <PlaidLinkButton onSuccess={fetchAccounts} />
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {lastUpdated && (
            <span>Updated {lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            onClick={fetchAccounts}
            className="p-1 rounded hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} onBalanceUpdate={fetchAccounts} />
        ))}
      </div>
    </div>
  );
}
