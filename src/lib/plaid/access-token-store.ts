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
        "A valid HTTP REST Redis/KV URL and token were not found (KV_REST_API_URL/main_KV_REST_API_URL/UPSTASH_REDIS_REST_URL with KV_REST_API_TOKEN/main_KV_REST_API_TOKEN/UPSTASH_REDIS_REST_TOKEN). Falling back to in-memory Plaid token storage. This will not persist across Vercel serverless invocations."
      );
    }
    return null;
  }

  // Strip trailing slash to avoid double-slash when concatenating paths
  const url = rawUrl.replace(/\/+$/, "");
  return { url, token };
}

async function kvRequest(path: string, method: "GET" | "POST" = "GET", body?: unknown) {
  const config = getKvConfig();
  if (!config) return null;

  const res = await fetch(`${config.url}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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

  // POST /set/<key> with value as body — correct Upstash REST API format
  await kvRequest(`/set/${encodeURIComponent(KV_KEY)}`, "POST", JSON.stringify(tokens));
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
