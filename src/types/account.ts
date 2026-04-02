export interface CreditCardAccount {
  id: string;
  name: string;
  last4: string;
  institution: string;
  currentBalance: number;
  creditLimit: number;
  availableCredit: number;
  paymentDueDate: string;
  minimumPayment: number;
  apr: number;
  lastPaymentAmount: number;
  lastPaymentDate: string;
  color: string;
}
