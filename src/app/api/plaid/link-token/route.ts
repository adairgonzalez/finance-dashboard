import { client, useMock } from "@/lib/plaid/client";
import { CountryCode, Products } from "plaid";
import { NextResponse } from "next/server";

export async function POST() {
  if (useMock || !client) {
    return NextResponse.json(
      { error: "Plaid is in demo mode" },
      { status: 400 }
    );
  }

  const response = await client.linkTokenCreate({
    user: { client_user_id: "user-1" },
    client_name: "FinanceHub",
    products: [Products.Liabilities],
    country_codes: [CountryCode.Us],
    language: "en",
  });

  return NextResponse.json({ link_token: response.data.link_token });
}
