import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";
export {
  addAccessToken,
  clearAccessTokens,
  getAccessTokens,
} from "@/lib/plaid/access-token-store";

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

export { client, useMock };
