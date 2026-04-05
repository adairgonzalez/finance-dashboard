/**
 * Shared KV store helper — wraps Upstash/Vercel KV REST API.
 * Used for persisting chat history, bills, paycheck settings, and Plaid tokens.
 */

let hasWarned = false;

function getConfig() {
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
    if (!hasWarned) {
      hasWarned = true;
      console.warn("[kv] No valid HTTP REST Redis/KV URL+token found. Data will not persist.");
    }
    return null;
  }

  return { url: rawUrl.replace(/\/+$/, ""), token };
}

async function command(...args: string[]): Promise<{ result: unknown } | null> {
  const config = getConfig();
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
    throw new Error(`KV ${args[0]} failed: ${res.status} — ${text}`);
  }

  return (await res.json()) as { result: unknown };
}

/** GET a JSON value from KV. Returns null if KV is unavailable or key doesn't exist. */
export async function kvGet<T>(key: string): Promise<T | null> {
  const data = await command("GET", key);
  if (!data) return null;

  const raw = data.result;
  if (!raw) return null;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  return raw as T;
}

/** SET a JSON value in KV. No-op if KV is unavailable. */
export async function kvSet(key: string, value: unknown): Promise<void> {
  await command("SET", key, JSON.stringify(value));
}

/** DEL a key from KV. No-op if KV is unavailable. */
export async function kvDel(key: string): Promise<void> {
  await command("DEL", key);
}

/** Check if KV is configured and available. */
export function kvAvailable(): boolean {
  return getConfig() !== null;
}
