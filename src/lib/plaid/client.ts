import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
import fs from "fs";
import path from "path";

const useMock =
  !process.env.PLAID_CLIENT_ID ||
  process.env.PLAID_CLIENT_ID === "demo";

const configuration = useMock
  ? null
  : new Configuration({
      basePath:
        PlaidEnvironments[process.env.PLAID_ENV || "sandbox"],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID!,
          "PLAID-SECRET": process.env.PLAID_SECRET!,
        },
      },
    });

const client = configuration ? new PlaidApi(configuration) : null;

const TOKENS_FILE = path.join(process.cwd(), "plaid-tokens.json");

function loadTokens(): string[] {
  try {
    if (fs.existsSync(TOKENS_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKENS_FILE, "utf-8"));
      return Array.isArray(data) ? data : [];
    }
  } catch {}
  return [];
}

function saveTokens(tokens: string[]) {
  try {
    fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
  } catch (err) {
    console.error("Failed to save Plaid tokens:", err);
  }
}

export function addAccessToken(token: string) {
  const tokens = loadTokens();
  if (!tokens.includes(token)) {
    tokens.push(token);
    saveTokens(tokens);
  }
}

export function getAccessTokens(): string[] {
  return loadTokens();
}

export function clearAccessTokens() {
  saveTokens([]);
}

export { client, useMock };
