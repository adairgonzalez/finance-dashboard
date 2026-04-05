import Anthropic from "@anthropic-ai/sdk";
import { getMockAccounts } from "@/lib/plaid/mock-data";
import { CreditCardAccount } from "@/types/account";
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

  const totalDebt = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
  const totalCredit = accounts.reduce((sum, a) => sum + a.creditLimit, 0);
  const utilizationPct =
    totalCredit > 0 ? ((totalDebt / totalCredit) * 100).toFixed(1) : "0.0";
  const accountsSection =
    accounts.length > 0
      ? accounts
          .map(
            (a) =>
              `- ${a.name} (****${a.last4}): Balance $${a.currentBalance.toFixed(2)} / $${a.creditLimit.toFixed(2)} limit, APR ${(a.apr * 100).toFixed(1)}%, Min payment $${a.minimumPayment.toFixed(2)}, Due ${a.paymentDueDate}`
          )
          .join("\n")
      : "- No connected accounts found.";

  const systemPrompt = `You are a helpful, friendly financial advisor assistant built into a personal finance dashboard. You have access to the user's real-time credit card data shown below.

Answer questions about their finances, explain spending patterns, suggest payment strategies, and provide general financial advice. Be specific and reference their actual numbers when relevant. Keep responses concise and actionable.

USER'S CREDIT CARD ACCOUNTS:
${accountsSection}

SUMMARY:
- Total debt: $${totalDebt.toFixed(2)}
- Total credit limit: $${totalCredit.toFixed(2)}
- Overall utilization: ${utilizationPct}%

Current date: ${new Date().toISOString().split("T")[0]}

Guidelines:
- If asked about paycheck allocation, help them prioritize using the avalanche method (highest APR first) or snowball method (smallest balance first) based on their preference.
- Flag any cards with high utilization (>30%) or upcoming due dates.
- Be encouraging but honest about their financial situation.`;

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m: { role: string; content: string }) => ({
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
