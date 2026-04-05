const KV_KEY = process.env.PLAID_TOKENS_KEY || "plaid:access_tokens";

const memoryTokens = new Set<string>();
let hasWarnedAboutMemoryFallback = false;

function getKvConfig() {
  const url =
    process.env.REDIS_URL ||
    process.env.main_REDIS_URL ||
    process.env.KV_REST_API_URL ||
    process.env.main_KV_REST_API_URL ||
    process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.REDIS_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.main_KV_REST_API_TOKEN ||
    process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.VERCEL && !hasWarnedAboutMemoryFallback) {
      hasWarnedAboutMemoryFallback = true;
      console.warn(
        "REDIS_URL/REDIS_TOKEN, main_REDIS_URL/main_KV_REST_API_TOKEN, KV_REST_API_URL/KV_REST_API_TOKEN, or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN not set. Falling back to in-memory Plaid token storage. This will not persist across Vercel serverless invocations."
      );
    }
    return null;
  }

  return { url, token };
}

async function kvRequest(path: string) {
  const config = getKvConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`KV request failed: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { result?: unknown };
}

async function getTokensFromKv(): Promise<string[] | null> {
  const config = getKvConfig();
  if (!config) return null;

  const data = await kvRequest(`/get/${encodeURIComponent(KV_KEY)}`);
  const raw = data?.result;

  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string");
  }
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
  const config = getKvConfig();
  if (!config) return;

  const value = encodeURIComponent(JSON.stringify(tokens));
  await kvRequest(`/set/${encodeURIComponent(KV_KEY)}/${value}`);
}

export async function addAccessToken(token: string) {
  try {
    const kvTokens = await getTokensFromKv();
    if (kvTokens) {
      if (!kvTokens.includes(token)) {
        kvTokens.push(token);
        await setTokensInKv(kvTokens);
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
    if (kvTokens) return kvTokens;
  } catch (err) {
    console.error("Failed to read Plaid access tokens from KV:", err);
  }

  return Array.from(memoryTokens);
}

export async function clearAccessTokens() {
  try {
    const kvTokens = await getTokensFromKv();
    if (kvTokens) {
      await setTokensInKv([]);
      return;
    }
  } catch (err) {
    console.error("Failed to clear Plaid access tokens from KV:", err);
  }

  memoryTokens.clear();
}
