const KV_KEY = process.env.PLAID_TOKENS_KEY || "plaid:access_tokens";

const memoryTokens = new Set<string>();
let hasWarnedAboutMemoryFallback = false;

function getKvConfig() {
  const rawUrl =
    process.env.KV_REST_API_URL ||
    process.env.main_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.REDIS_URL ||
    process.env.main_REDIS_URL;
  const token =
    process.env.REDIS_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.main_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  const isHttpUrl = !!rawUrl && /^https?:\/\//i.test(rawUrl);

  if (!rawUrl || !token || !isHttpUrl) {
    if (!hasWarnedAboutMemoryFallback) {
      hasWarnedAboutMemoryFallback = true;
      console.warn(
        "No valid HTTP REST Redis/KV URL+token found. Falling back to in-memory token storage."
      );
    }
    return null;
  }

  const url = rawUrl.replace(/\/+$/, "");
  return { url, token };
}

/**
 * Send a Redis command via the Upstash REST API.
 * Uses POST with JSON body: ["COMMAND", "arg1", "arg2", ...]
 * This avoids all URL-encoding issues with values in the path.
 */
async function kvCommand(...args: string[]): Promise<{ result: unknown } | null> {
  const config = getKvConfig();
  if (!config) return null;

  const res = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`KV ${args[0]} failed: ${res.status} ${res.statusText} — ${text}`);
  }

  return (await res.json()) as { result: unknown };
}

async function getTokensFromKv(): Promise<string[] | null> {
  const data = await kvCommand("GET", KV_KEY);
  if (!data) return null; // no KV config

  const raw = data.result;
  if (!raw) return [];

  if (typeof raw !== "string") return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

async function setTokensInKv(tokens: string[]) {
  await kvCommand("SET", KV_KEY, JSON.stringify(tokens));
}

export async function addAccessToken(token: string) {
  try {
    const kvTokens = await getTokensFromKv();
    if (kvTokens !== null) {
      if (!kvTokens.includes(token)) {
        kvTokens.push(token);
        await setTokensInKv(kvTokens);
        console.log(`Saved ${kvTokens.length} token(s) to KV`);
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
    const kvTokens = await getTokensFromKv();
    if (kvTokens !== null) return kvTokens;
  } catch (err) {
    console.error("Failed to read Plaid access tokens from KV:", err);
  }

  return Array.from(memoryTokens);
}

export async function clearAccessTokens() {
  try {
    const result = await kvCommand("DEL", KV_KEY);
    if (result !== null) return;
  } catch (err) {
    console.error("Failed to clear Plaid access tokens from KV:", err);
  }

  memoryTokens.clear();
}
