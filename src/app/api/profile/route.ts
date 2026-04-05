import { kvGet, kvSet } from "@/lib/kv";
import { NextRequest, NextResponse } from "next/server";

const KV_KEY = "user:profile";

interface UserProfile {
  monthlyPaycheck: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
}

export async function GET() {
  try {
    const profile = await kvGet<UserProfile>(KV_KEY);
    return NextResponse.json(profile ?? { monthlyPaycheck: 0, payFrequency: "biweekly" });
  } catch (err) {
    console.error("Failed to load profile:", err);
    return NextResponse.json({ monthlyPaycheck: 0, payFrequency: "biweekly" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const profile: UserProfile = await req.json();
    await kvSet(KV_KEY, profile);
    return NextResponse.json(profile);
  } catch (err) {
    console.error("Failed to save profile:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
