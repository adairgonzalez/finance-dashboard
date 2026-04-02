import { getMockAccounts } from "@/lib/plaid/mock-data";
import { NextResponse } from "next/server";

export async function GET() {
  const accounts = getMockAccounts();
  return NextResponse.json(accounts);
}
