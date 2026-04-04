import { client, useMock, addAccessToken } from "@/lib/plaid/client";
import { NextRequest, NextResponse } from "next/server";

function getPlaidErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const maybeResponse = (err as { response?: { data?: { error_message?: string } } }).response;
    const msg = maybeResponse?.data?.error_message;
    if (msg) return msg;
  }

  if (err instanceof Error) return err.message;
  return "Failed to exchange Plaid public token";
}

export async function POST(req: NextRequest) {
  if (useMock || !client) {
    return NextResponse.json(
      { error: "Plaid is in demo mode" },
      { status: 400 }
    );
  }

  const { public_token } = await req.json();

  try {
    const response = await client.itemPublicTokenExchange({
      public_token,
    });

    await addAccessToken(response.data.access_token);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Plaid exchange token error:", err);
    return NextResponse.json({ error: getPlaidErrorMessage(err) }, { status: 400 });
  }
}
