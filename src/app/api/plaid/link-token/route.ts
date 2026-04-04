import { client, useMock } from "@/lib/plaid/client";
import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";

function getPlaidErrorMessage(err: unknown): string {
  if (typeof err === "object" && err !== null) {
    const maybeResponse = (err as { response?: { data?: { error_message?: string } } }).response;
    const msg = maybeResponse?.data?.error_message;
    if (msg) return msg;
  }

  if (err instanceof Error) return err.message;
  return "Failed to create Plaid link token";
}

export async function POST() {
  if (useMock || !client) {
    return NextResponse.json(
      { error: "Plaid is in demo mode" },
      { status: 400 }
    );
  }

  try {
    const response = await client.linkTokenCreate({
      user: { client_user_id: "user-1" },
      client_name: "FinanceHub",
      products: [Products.Liabilities],
      country_codes: [CountryCode.Us],
      language: "en",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error("Plaid link token error:", err);
    return NextResponse.json({ error: getPlaidErrorMessage(err) }, { status: 400 });
  }
}
