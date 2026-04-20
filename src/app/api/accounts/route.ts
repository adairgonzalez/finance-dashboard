import { getMockAccounts } from "@/lib/plaid/mock-data";
import { client, useMock, getAccessTokens } from "@/lib/plaid/client";
import { getBalanceOverrides } from "@/lib/balance-overrides";
import { CreditCardAccount } from "@/types/account";
import { NextResponse } from "next/server";

const CARD_COLORS = ["#1a3c6e", "#c5a44e", "#003b70", "#ff6000", "#d03027", "#5b21b6", "#0f766e", "#be185d"];

function applyOverrides(accounts: CreditCardAccount[]): CreditCardAccount[] {
  const overrides = getBalanceOverrides();
  return accounts.map((acct) => {
    const override = overrides[acct.id];
    if (override) {
      const balance = override.currentBalance;
      const limit = override.creditLimit > 0 ? override.creditLimit : acct.creditLimit;
      return {
        ...acct,
        currentBalance: balance,
        creditLimit: limit,
        availableCredit: limit - balance,
      };
    }
    return acct;
  });
}

export async function GET() {
  if (useMock || !client) {
    return NextResponse.json(applyOverrides(getMockAccounts()));
  }

  const tokens = getAccessTokens();
  if (tokens.length === 0) {
    // No Plaid accounts linked yet — fall back to mock accounts with any
    // balance overrides applied (e.g. pushed by the Copilot balance fetcher script)
    return NextResponse.json(applyOverrides(getMockAccounts()));
  }

  const accounts: CreditCardAccount[] = [];
  let colorIndex = 0;

  for (const accessToken of tokens) {
    try {
      const [accountsRes, liabilitiesRes] = await Promise.all([
        client.accountsGet({ access_token: accessToken }),
        client.liabilitiesGet({ access_token: accessToken }).catch(() => null),
      ]);

      const creditCards = accountsRes.data.accounts.filter(
        (a) => a.type === "credit"
      );

      const liabilities = liabilitiesRes?.data.liabilities.credit || [];

      for (const acct of creditCards) {
        const liability = liabilities.find(
          (l) => l.account_id === acct.account_id
        );

        const currentBalance = acct.balances.current ?? 0;
        const creditLimit = acct.balances.limit ?? 0;

        accounts.push({
          id: acct.account_id,
          name: acct.official_name || acct.name,
          last4: acct.mask || "****",
          institution: acct.name,
          currentBalance,
          creditLimit,
          availableCredit: creditLimit - currentBalance,
          paymentDueDate:
            liability?.next_payment_due_date ||
            new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          minimumPayment: liability?.minimum_payment_amount ?? 25,
          apr: liability?.aprs?.[0]?.apr_percentage
            ? liability.aprs[0].apr_percentage / 100
            : 0.1999,
          lastPaymentAmount: liability?.last_payment_amount ?? 0,
          lastPaymentDate:
            liability?.last_payment_date ||
            new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
          color: CARD_COLORS[colorIndex++ % CARD_COLORS.length],
        });
      }
    } catch (err) {
      console.error("Error fetching Plaid accounts:", err);
    }
  }

  return NextResponse.json(applyOverrides(accounts));
}
