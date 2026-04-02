import { client, useMock, addAccessToken } from "@/lib/plaid/client";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (useMock || !client) {
    return NextResponse.json(
      { error: "Plaid is in demo mode" },
      { status: 400 }
    );
  }

  const { public_token } = await req.json();

  const response = await client.itemPublicTokenExchange({
    public_token,
  });

  addAccessToken(response.data.access_token);

  return NextResponse.json({ success: true });
}
