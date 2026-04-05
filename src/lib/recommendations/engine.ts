import { CreditCardAccount } from "@/types/account";
import { Bill } from "@/types/bill";
import { PaycheckInput, AllocationResult, AllocationItem } from "@/types/recommendation";

const BILL_CATEGORY_COLORS: Record<string, string> = {
  housing: "#ef4444",
  utilities: "#f59e0b",
  insurance: "#3b82f6",
  subscriptions: "#8b5cf6",
  loans: "#ec4899",
  other: "#6b7280",
};

export function calculateAllocation(
  input: PaycheckInput,
  accounts: CreditCardAccount[],
  bills: Bill[] = []
): AllocationResult {
  const items: AllocationItem[] = [];
  let remaining = input.amount;
  let priority = 1;

  // 1. Fixed expenses (legacy field) — only used if no bills are tracked
  if (bills.length === 0 && input.fixedExpenses > 0) {
    items.push({
      category: "Fixed Expenses",
      amount: input.fixedExpenses,
      reason: "Rent, utilities, subscriptions, and other recurring bills",
      priority: priority++,
      color: "#6b7280",
    });
    remaining -= input.fixedExpenses;
  }

  // 1b. Itemized bills (when tracked)
  if (bills.length > 0) {
    // Scale bills to paycheck frequency
    let billScale = 1;
    if (input.frequency === "biweekly" || input.frequency === "semimonthly") {
      billScale = 0.5; // half a month per paycheck
    } else if (input.frequency === "weekly") {
      billScale = 12 / 52; // ~0.23
    }

    for (const bill of bills.sort((a, b) => a.dueDay - b.dueDay)) {
      const scaled = Math.round(bill.amount * billScale * 100) / 100;
      items.push({
        category: bill.name,
        amount: scaled,
        reason: `${bill.category} bill, due ${bill.dueDay}${bill.dueDay === 1 ? "st" : bill.dueDay === 2 ? "nd" : bill.dueDay === 3 ? "rd" : "th"}${bill.isAutoPay ? " (auto-pay)" : ""}`,
        priority: priority++,
        color: BILL_CATEGORY_COLORS[bill.category] || "#6b7280",
      });
      remaining -= scaled;
    }
  }

  // 2. Minimum payments on all cards (mandatory)
  const sortedByDue = [...accounts].sort(
    (a, b) => new Date(a.paymentDueDate).getTime() - new Date(b.paymentDueDate).getTime()
  );

  const nextPayDate = new Date(input.nextPayDate);
  const cardsWithUpcomingDue = sortedByDue.filter((a) => {
    const due = new Date(a.paymentDueDate);
    const nextNextPay = new Date(nextPayDate);
    if (input.frequency === "biweekly" || input.frequency === "semimonthly") {
      nextNextPay.setDate(nextNextPay.getDate() + 15);
    } else if (input.frequency === "weekly") {
      nextNextPay.setDate(nextNextPay.getDate() + 7);
    } else {
      nextNextPay.setMonth(nextNextPay.getMonth() + 1);
    }
    return due <= nextNextPay && a.currentBalance > 0;
  });

  const minimumPayments: AllocationItem[] = [];
  for (const card of cardsWithUpcomingDue) {
    const minPayment = Math.min(card.minimumPayment, card.currentBalance, remaining);
    if (minPayment > 0) {
      minimumPayments.push({
        category: `${card.name} (min)`,
        amount: minPayment,
        reason: `Minimum payment due ${card.paymentDueDate} — avoid late fees`,
        priority: priority++,
        color: card.color,
      });
      remaining -= minPayment;
    }
  }
  items.push(...minimumPayments);

  // 3. Savings goal
  const savingsAmount = Math.min(
    input.amount * (input.savingsGoalPercent / 100),
    remaining * 0.5
  );
  if (savingsAmount > 0) {
    items.push({
      category: "Savings",
      amount: Math.round(savingsAmount * 100) / 100,
      reason: `${input.savingsGoalPercent}% savings goal — building your emergency fund`,
      priority: priority++,
      color: "#22c55e",
    });
    remaining -= savingsAmount;
  }

  // 4. Extra payments using avalanche method (highest APR first)
  const sortedByAPR = [...accounts]
    .filter((a) => a.currentBalance > 0)
    .sort((a, b) => b.apr - a.apr);

  for (const card of sortedByAPR) {
    if (remaining <= 10) break;

    const alreadyPaid = minimumPayments.find((m) =>
      m.category.startsWith(card.name)
    );
    const alreadyPaidAmount = alreadyPaid ? alreadyPaid.amount : 0;
    const remainingBalance = card.currentBalance - alreadyPaidAmount;

    if (remainingBalance <= 0) continue;

    const extraPayment = Math.min(remaining * 0.4, remainingBalance);
    if (extraPayment >= 10) {
      items.push({
        category: `${card.name} (extra)`,
        amount: Math.round(extraPayment * 100) / 100,
        reason: `APR ${(card.apr * 100).toFixed(1)}% — highest interest, pay down first`,
        priority: priority++,
        color: card.color,
      });
      remaining -= extraPayment;
    }
  }

  // 5. Discretionary buffer
  if (remaining > 0) {
    items.push({
      category: "Discretionary",
      amount: Math.round(remaining * 100) / 100,
      reason: "Groceries, dining, entertainment, and unexpected expenses",
      priority: priority++,
      color: "#3b82f6",
    });
  }

  const totalAllocated = items.reduce((sum, item) => sum + item.amount, 0);

  const highAPRCards = accounts.filter((a) => a.apr > 0.2 && a.currentBalance > 0);
  const upcomingDues = cardsWithUpcomingDue.length;

  let summary = `Based on your $${input.amount.toLocaleString()} paycheck, here's your recommended allocation. `;
  if (bills.length > 0) {
    const totalBillsScaled = items
      .filter((i) => bills.some((b) => b.name === i.category))
      .reduce((s, i) => s + i.amount, 0);
    summary += `$${totalBillsScaled.toFixed(0)} goes to ${bills.length} tracked bill${bills.length > 1 ? "s" : ""}. `;
  }
  if (highAPRCards.length > 0) {
    summary += `Focus extra payments on ${highAPRCards[0].name} (${(highAPRCards[0].apr * 100).toFixed(1)}% APR) to save the most on interest. `;
  }
  if (upcomingDues > 0) {
    summary += `${upcomingDues} card${upcomingDues > 1 ? "s have" : " has"} payments due before your next check.`;
  }

  return {
    items,
    totalAllocated: Math.round(totalAllocated * 100) / 100,
    remainingBuffer: Math.round(remaining * 100) / 100,
    summary,
  };
}
