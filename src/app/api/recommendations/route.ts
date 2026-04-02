import { getMockAccounts } from "@/lib/plaid/mock-data";
import { calculateAllocation } from "@/lib/recommendations/engine";
import { PaycheckInput } from "@/types/recommendation";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const input: PaycheckInput = await req.json();
  const accounts = getMockAccounts();
  const result = calculateAllocation(input, accounts);
  return NextResponse.json(result);
}
