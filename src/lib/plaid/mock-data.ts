import { CreditCardAccount } from "@/types/account";

export function getMockAccounts(): CreditCardAccount[] {
  const today = new Date();
  const dueDate = (daysFromNow: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + daysFromNow);
    return d.toISOString().split("T")[0];
  };
  const pastDate = (daysAgo: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split("T")[0];
  };

  return [
    {
      id: "acc_chase_sapphire",
      name: "Chase Sapphire Preferred",
      last4: "4289",
      institution: "Chase",
      currentBalance: 2847.32,
      creditLimit: 12000,
      availableCredit: 9152.68,
      paymentDueDate: dueDate(8),
      minimumPayment: 85.0,
      apr: 0.2199,
      lastPaymentAmount: 500.0,
      lastPaymentDate: pastDate(22),
      color: "#1a3c6e",
    },
    {
      id: "acc_amex_gold",
      name: "American Express Gold",
      last4: "7821",
      institution: "American Express",
      currentBalance: 1523.89,
      creditLimit: 8000,
      availableCredit: 6476.11,
      paymentDueDate: dueDate(3),
      minimumPayment: 45.0,
      apr: 0.2499,
      lastPaymentAmount: 200.0,
      lastPaymentDate: pastDate(28),
      color: "#c5a44e",
    },
    {
      id: "acc_citi_double",
      name: "Citi Double Cash",
      last4: "3156",
      institution: "Citibank",
      currentBalance: 4210.55,
      creditLimit: 15000,
      availableCredit: 10789.45,
      paymentDueDate: dueDate(15),
      minimumPayment: 126.0,
      apr: 0.1899,
      lastPaymentAmount: 350.0,
      lastPaymentDate: pastDate(18),
      color: "#003b70",
    },
    {
      id: "acc_discover_it",
      name: "Discover It Cash Back",
      last4: "9034",
      institution: "Discover",
      currentBalance: 678.42,
      creditLimit: 5000,
      availableCredit: 4321.58,
      paymentDueDate: dueDate(21),
      minimumPayment: 25.0,
      apr: 0.1549,
      lastPaymentAmount: 150.0,
      lastPaymentDate: pastDate(10),
      color: "#ff6000",
    },
    {
      id: "acc_capital_one",
      name: "Capital One Venture X",
      last4: "6612",
      institution: "Capital One",
      currentBalance: 3392.1,
      creditLimit: 20000,
      availableCredit: 16607.9,
      paymentDueDate: dueDate(12),
      minimumPayment: 102.0,
      apr: 0.2699,
      lastPaymentAmount: 400.0,
      lastPaymentDate: pastDate(15),
      color: "#d03027",
    },
  ];
}
