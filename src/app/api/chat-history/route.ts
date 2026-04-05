import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { NextRequest, NextResponse } from "next/server";

const KV_KEY = "chat:history";

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export async function GET() {
  try {
    const messages = await kvGet<StoredMessage[]>(KV_KEY);
    return NextResponse.json(messages ?? []);
  } catch (err) {
    console.error("Failed to load chat history:", err);
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = (await req.json()) as { messages: StoredMessage[] };
    // Keep last 100 messages to avoid unbounded growth
    const trimmed = messages.slice(-100);
    await kvSet(KV_KEY, trimmed);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to save chat history:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await kvDel(KV_KEY);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to clear chat history:", err);
    return NextResponse.json({ error: "Failed to clear" }, { status: 500 });
  }
}
