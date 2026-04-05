import { getMockAccounts } from "@/lib/plaid/mock-data";
import { getAccessTokens, client, useMock } from "@/lib/plaid/client";
import { calculateAllocation } from "@/lib/recommendations/engine";
import { PaycheckInput } from "@/types/recommendation";
import { Bill } from "@/types/bill";
import { CreditCardAccount } from "@/types/account";
import { kvGet } from "@/lib/kv";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const input: PaycheckInput = await req.json();

  // Get real accounts if available, otherwise mock
  let accounts: CreditCardAccount[];
  if (!useMock && client) {
    try {
      const tokens = await getAccessTokens();
      accounts = [];
      for (const accessToken of tokens) {
        const [accountsRes, liabilitiesRes] = await Promise.all([
          client.accountsGet({ access_token: accessToken }),
          client.liabilitiesGet({ access_token: accessToken }).catch(() => null),
        ]);
        const creditCards = accountsRes.data.accounts.filter((a) => a.type === "credit");
        const liabilities = liabilitiesRes?.data.liabilities.credit || [];
        for (const acct of creditCards) {
          const liability = liabilities.find((l) => l.account_id === acct.account_id);
          accounts.push({
            id: acct.account_id,
            name: acct.official_name || acct.name,
            last4: acct.mask || "****",
            institution: acct.name,
            currentBalance: acct.balances.current ?? 0,
            creditLimit: acct.balances.limit ?? 0,
            availableCredit: (acct.balances.limit ?? 0) - (acct.balances.current ?? 0),
            paymentDueDate: liability?.next_payment_due_date || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
            minimumPayment: liability?.minimum_payment_amount ?? 25,
            apr: liability?.aprs?.[0]?.apr_percentage ? liability.aprs[0].apr_percentage / 100 : 0.1999,
            lastPaymentAmount: liability?.last_payment_amount ?? 0,
            lastPaymentDate: liability?.last_payment_date || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
            color: "#1a3c6e",
          });
        }
      }
      if (accounts.length === 0) accounts = getMockAccounts();
    } catch {
      accounts = getMockAccounts();
    }
  } else {
    accounts = getMockAccounts();
  }

  // Load bills from KV
  let bills: Bill[] = [];
  try {
    const b = await kvGet<Bill[]>("user:bills");
    if (b) bills = b;
  } catch {
    // proceed without
  }

  const result = calculateAllocation(input, accounts, bills);
  return NextResponse.json(result);
}
