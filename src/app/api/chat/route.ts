import Anthropic from "@anthropic-ai/sdk";
import { getMockAccounts } from "@/lib/plaid/mock-data";
import { CreditCardAccount } from "@/types/account";
import { Bill } from "@/types/bill";
import { kvGet } from "@/lib/kv";
import { NextRequest } from "next/server";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  const {
    messages,
    accounts: providedAccounts,
  } = (await req.json()) as {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    accounts?: CreditCardAccount[];
  };

  const accounts = Array.isArray(providedAccounts)
    ? providedAccounts
    : getMockAccounts();

  // Load bills and profile from KV for full context
  let bills: Bill[] = [];
  let monthlyPaycheck = 0;
  let partnerMonthlyIncome = 0;
  let oneTimeBonus = 0;
  let payFrequency = "biweekly";
  try {
    const [b, p] = await Promise.all([
      kvGet<Bill[]>("user:bills"),
      kvGet<{
        monthlyPaycheck: number;
        partnerMonthlyIncome: number;
        oneTimeBonus: number;
        payFrequency: string;
      }>("user:profile"),
    ]);

    if (b) bills = b;
    if (p) {
      monthlyPaycheck = p.monthlyPaycheck || 0;
      partnerMonthlyIncome = p.partnerMonthlyIncome || 0;
      oneTimeBonus = p.oneTimeBonus || 0;
      payFrequency = p.payFrequency || "biweekly";
    }
  } catch {
    // Non-critical — proceed without
  }

  const totalDebt = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCredit = accounts.reduce((sum, a) => sum + a.creditLimit, 0);
  const utilizationPct =
    totalCredit > 0 ? ((totalDebt / totalCredit) * 100).toFixed(1) : "0.0";
  const totalBills = bills.reduce((sum, b) => sum + b.amount, 0);

  const totalMonthlyIncome = monthlyPaycheck + partnerMonthlyIncome;

  const accountsSection =
    accounts.length > 0
      ? accounts
          .map(
            (a) =>
              `- ${a.name} (****${a.last4}): Balance $${a.currentBalance.toFixed(2)} / $${a.creditLimit.toFixed(2)} limit, APR ${(a.apr * 100).toFixed(1)}%, Min payment $${a.minimumPayment.toFixed(2)}, Due ${a.paymentDueDate}`
          )
          .join("\n")
      : "- No connected accounts found.";

  const billsSection =
    bills.length > 0
      ? bills
          .map(
            (b) =>
              `- ${b.name}: $${b.amount.toFixed(2)}/mo, due ${b.dueDay}${b.dueDay === 1 ? "st" : b.dueDay === 2 ? "nd" : b.dueDay === 3 ? "rd" : "th"}, category: ${b.category}${b.isAutoPay ? " (auto-pay)" : ""}`
          )
          .join("\n")
      : "- No bills tracked yet.";

  const incomeSection =
    totalMonthlyIncome > 0
      ? `
- Your income: $${monthlyPaycheck.toFixed(2)}/month (paid ${payFrequency})
- Partner's income: $${partnerMonthlyIncome.toFixed(2)}/month
- Combined monthly income: $${totalMonthlyIncome.toFixed(2)}
${oneTimeBonus > 0 ? `- One-time bonus (next paycheck): $${oneTimeBonus.toFixed(2)}` : ""}
`
      : "Not set";

  const systemPrompt = `You are a helpful, friendly financial advisor assistant built into a personal finance dashboard. You have access to the user's real-time financial data shown below.

Answer questions about their finances, explain spending patterns, suggest payment strategies, and provide general financial advice. Be specific and reference their actual numbers when relevant. Keep responses concise and actionable.

USER'S CREDIT CARD ACCOUNTS:
${accountsSection}

USER'S MONTHLY BILLS:
${billsSection}

USER'S INCOME & BONUSES:
${incomeSection}

SUMMARY:
- Combined monthly income: ${totalMonthlyIncome > 0 ? `$${totalMonthlyIncome.toFixed(2)}` : "Not set"}
- Total monthly bills: $${totalBills.toFixed(2)}
- After bills: ${totalMonthlyIncome > 0 ? `$${(totalMonthlyIncome - totalBills).toFixed(2)}` : "Unknown"}
- Total credit card debt: $${totalDebt.toFixed(2)}
- Total credit limit: $${totalCredit.toFixed(2)}
- Overall utilization: ${utilizationPct}%
${oneTimeBonus > 0 ? `- Upcoming one-time bonus: $${oneTimeBonus.toFixed(2)}` : ""}

Current date: ${new Date().toISOString().split("T")[0]}

Guidelines:
- If asked about paycheck allocation, factor in their bills as mandatory expenses before recommending debt payments.
- If the user has a one-time bonus, suggest strategies for allocating it effectively (e.g., paying down high-interest debt, building an emergency fund).
- Use the avalanche method (highest APR first) or snowball method (smallest balance first) based on their preference.
- Flag any cards with high utilization (>30%) or upcoming due dates.
- When discussing budgets, account for their tracked bills as fixed expenses.
- Be encouraging but honest about their financial situation.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
