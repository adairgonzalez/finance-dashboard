import { kvGet, kvSet } from "@/lib/kv";
import { NextRequest, NextResponse } from "next/server";

const KV_KEY = "user:profile";

interface UserProfile {
  monthlyPaycheck: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  partnerIncome: number;
  bonusAmount: number;
  bonusIncluded: boolean;
}

const defaults: UserProfile = {
  monthlyPaycheck: 0,
  payFrequency: "biweekly",
  partnerIncome: 0,
  bonusAmount: 0,
  bonusIncluded: false,
};

export async function GET() {
  try {
    const profile = await kvGet<UserProfile>(KV_KEY);
    return NextResponse.json({ ...defaults, ...profile });
  } catch (err) {
    console.error("Failed to load profile:", err);
    return NextResponse.json(defaults);
  }
}

export async function POST(req: NextRequest) {
  try {
    const incoming = await req.json();
    // Merge with existing to preserve fields not sent
    const existing = (await kvGet<UserProfile>(KV_KEY)) ?? defaults;
    const profile: UserProfile = { ...existing, ...incoming };
    await kvSet(KV_KEY, profile);
    return NextResponse.json(profile);
  } catch (err) {
    console.error("Failed to save profile:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
