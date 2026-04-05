export interface Bill {
  id: string;
  name: string;
  amount: number;
  dueDay: number; // day of month (1-31)
  category: "housing" | "utilities" | "insurance" | "subscriptions" | "loans" | "other";
  isAutoPay: boolean;
}

export interface UserFinancialProfile {
  monthlyPaycheck: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  bills: Bill[];
}
