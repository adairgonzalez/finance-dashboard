"use client";

import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Plus, Loader2, Link2 } from "lucide-react";

interface PlaidLinkButtonProps {
  onSuccess: () => void;
}

export function PlaidLinkButton({ onSuccess }: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLinkToken = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plaid/link-token", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setLinkToken(data.link_token);
    } catch {
      setError("Failed to initialize Plaid Link");
    } finally {
      setIsLoading(false);
    }
  };

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      try {
        await fetch("/api/plaid/exchange-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ public_token: publicToken }),
        });
        onSuccess();
      } catch {
        setError("Failed to connect account");
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
  });

  if (linkToken && ready) {
    return (
      <button
        onClick={() => open()}
        className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors"
      >
        <Link2 className="h-4 w-4" />
        Connect Your Bank
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={fetchLinkToken}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        Link a Credit Card
      </button>
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </div>
  );
}
