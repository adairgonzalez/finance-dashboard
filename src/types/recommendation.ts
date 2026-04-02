export interface PaycheckInput {
  amount: number;
  frequency: "biweekly" | "semimonthly" | "monthly";
  nextPayDate: string;
  fixedExpenses: number;
  savingsGoalPercent: number;
}

export interface AllocationItem {
  category: string;
  amount: number;
  reason: string;
  priority: number;
  color: string;
}

export interface AllocationResult {
  items: AllocationItem[];
  totalAllocated: number;
  remainingBuffer: number;
  summary: string;
}
