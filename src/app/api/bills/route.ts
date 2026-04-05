import { kvGet, kvSet } from "@/lib/kv";
import { Bill } from "@/types/bill";
import { NextRequest, NextResponse } from "next/server";

const KV_KEY = "user:bills";

export async function GET() {
  try {
    const bills = await kvGet<Bill[]>(KV_KEY);
    return NextResponse.json(bills ?? []);
  } catch (err) {
    console.error("Failed to load bills:", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const bill: Bill = await req.json();
    const bills = (await kvGet<Bill[]>(KV_KEY)) ?? [];

    const existing = bills.findIndex((b) => b.id === bill.id);
    if (existing >= 0) {
      bills[existing] = bill;
    } else {
      bills.push(bill);
    }

    await kvSet(KV_KEY, bills);
    return NextResponse.json(bills);
  } catch (err) {
    console.error("Failed to save bill:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id: string };
    const bills = (await kvGet<Bill[]>(KV_KEY)) ?? [];
    const filtered = bills.filter((b) => b.id !== id);
    await kvSet(KV_KEY, filtered);
    return NextResponse.json(filtered);
  } catch (err) {
    console.error("Failed to delete bill:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
