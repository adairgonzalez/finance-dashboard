import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

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

// In-memory store for access tokens (demo only — use a database in production)
const accessTokens: string[] = [];

export function addAccessToken(token: string) {
  if (!accessTokens.includes(token)) {
    accessTokens.push(token);
  }
}

export function getAccessTokens(): string[] {
  return accessTokens;
}

export { client, useMock };
