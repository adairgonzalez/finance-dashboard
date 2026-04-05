import { kvGet, kvSet, kvDel } from "@/lib/kv";

const KV_KEY = process.env.PLAID_TOKENS_KEY || "plaid:access_tokens";
const memoryTokens = new Set<string>();

export async function addAccessToken(token: string) {
  try {
    const tokens = await kvGet<string[]>(KV_KEY);
    if (tokens !== null) {
      if (!tokens.includes(token)) {
        tokens.push(token);
        await kvSet(KV_KEY, tokens);
      }
      return;
    }
  } catch (err) {
    console.error("Failed to persist Plaid access token in KV:", err);
  }
  memoryTokens.add(token);
}

export async function getAccessTokens(): Promise<string[]> {
  try {
    const tokens = await kvGet<string[]>(KV_KEY);
    if (tokens !== null) return tokens;
  } catch (err) {
    console.error("Failed to read Plaid access tokens from KV:", err);
  }
  return Array.from(memoryTokens);
}

export async function clearAccessTokens() {
  try {
    await kvDel(KV_KEY);
    return;
  } catch (err) {
    console.error("Failed to clear Plaid access tokens from KV:", err);
  }
  memoryTokens.clear();
}
