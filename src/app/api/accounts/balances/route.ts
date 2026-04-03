import { getBalanceOverrides, setBalanceOverride } from "@/lib/balance-overrides";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { accountId, currentBalance, creditLimit } = await req.json();

  if (!accountId || currentBalance === undefined) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  setBalanceOverride(
    accountId,
    Number(currentBalance),
    creditLimit !== undefined ? Number(creditLimit) : 0
  );

  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json(getBalanceOverrides());
}
