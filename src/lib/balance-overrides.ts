// In-memory balance overrides (persists while server is running)
const balanceOverrides: Record<string, { currentBalance: number; creditLimit: number }> = {};

export function getBalanceOverrides() {
  return balanceOverrides;
}

export function setBalanceOverride(accountId: string, currentBalance: number, creditLimit: number) {
  balanceOverrides[accountId] = { currentBalance, creditLimit };
}

export function clearBalanceOverrides() {
  for (const key of Object.keys(balanceOverrides)) {
    delete balanceOverrides[key];
  }
}
