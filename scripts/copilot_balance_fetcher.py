#!/usr/bin/env python3
"""
Copilot Money Balance Extractor
Extracts real-time account balances from your Copilot Money account
using their (unofficial) GraphQL API.

Usage:
  1. Get your auth token (see get_token_from_browser() or manual instructions)
  2. Run: python copilot_balance_fetcher.py
  3. Balances are printed and optionally pushed to your finance dashboard API
"""

import json
import sys
import os
import time
import subprocess
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# ─── Configuration ────────────────────────────────────────────────────────────

COPILOT_API_URL = "https://app.copilot.money/api/graphql"
TOKEN_FILE = Path.home() / ".config" / "copilot-money" / "token.txt"
DASHBOARD_API_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000")

# ─── GraphQL Queries ──────────────────────────────────────────────────────────

ACCOUNTS_QUERY = """
query Accounts($filter: AccountFilter) {
  accounts(filter: $filter) {
    ...AccountFields
    __typename
  }
}

fragment AccountFields on Account {
  hasHistoricalUpdates
  latestBalanceUpdate
  hasLiveBalance
  institutionId
  itemId
  id
  isUserHidden
  isUserClosed
  isManual
  liveBalance
  balance
  limit
  type
  subType
  name
  mask
  color
  __typename
}
"""

ACCOUNT_LIVE_BALANCE_QUERY = """
query AccountLiveBalance($itemId: ID!, $accountId: ID!) {
  accountLiveBalance(itemId: $itemId, accountId: $accountId) {
    ...BalanceFields
    __typename
  }
}

fragment BalanceFields on AccountBalanceHistory {
  balance
  date
  __typename
}
"""

NETWORTH_QUERY = """
query Networth($timeFrame: TimeFrame) {
  networthHistory(timeFrame: $timeFrame) {
    ...NetworthFields
    __typename
  }
}

fragment NetworthFields on NetworthHistory {
  assets
  date
  debt
  __typename
}
"""


# ─── Token Management ─────────────────────────────────────────────────────────

def load_token() -> Optional[str]:
    """Load saved auth token from disk."""
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text().strip()
        if token:
            return token
    # Also check env var
    env_token = os.environ.get("COPILOT_TOKEN")
    if env_token:
        return env_token
    return None


def save_token(token: str) -> None:
    """Save auth token to disk."""
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token)
    TOKEN_FILE.chmod(0o600)  # Read/write only for owner
    print(f"Token saved to {TOKEN_FILE}")


def get_token_from_browser() -> Optional[str]:
    """
    Interactive: opens Copilot Money login in browser and captures the token.
    Requires: pip install playwright && playwright install chromium
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    print("\nOpening Copilot Money login page...")
    print("Log in with your account. The token will be captured automatically.\n")

    captured_token = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        def handle_request(request):
            nonlocal captured_token
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer ") and "graphql" in request.url:
                captured_token = auth.replace("Bearer ", "")

        page.on("request", handle_request)
        page.goto("https://app.copilot.money")

        # Wait for user to log in and a GraphQL request to fire
        print("Waiting for you to log in...")
        for _ in range(120):  # 2 min timeout
            if captured_token:
                break
            time.sleep(1)

        browser.close()

    return captured_token


def get_token_manual() -> str:
    """
    Manual token extraction instructions.
    """
    print("""
╔══════════════════════════════════════════════════════════════════╗
║           How to get your Copilot Money auth token              ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  1. Open https://app.copilot.money in Chrome                    ║
║  2. Log in to your account                                       ║
║  3. Open DevTools (F12) → Network tab                            ║
║  4. Filter by "graphql"                                          ║
║  5. Click any request → Headers tab                              ║
║  6. Copy the "Authorization: Bearer ..." value                   ║
║     (just the part after "Bearer ")                              ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
""")
    token = input("Paste your Bearer token here: ").strip()
    if token.startswith("Bearer "):
        token = token[7:]
    return token


# ─── API Client ───────────────────────────────────────────────────────────────

def graphql_request(query: str, variables: dict, token: str) -> dict:
    """Make a GraphQL request to Copilot Money's API."""
    payload = json.dumps({
        "operationName": query.split("(")[0].split()[-1],
        "query": query,
        "variables": variables,
    }).encode("utf-8")

    req = urllib.request.Request(
        COPILOT_API_URL,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
            "User-Agent": "CopilotBalanceFetcher/1.0",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode() if e.fp else ""
        if e.code == 401:
            print("ERROR: Token expired or invalid. Please re-authenticate.")
            if TOKEN_FILE.exists():
                TOKEN_FILE.unlink()
            sys.exit(1)
        print(f"HTTP {e.code}: {body}")
        sys.exit(1)


def fetch_accounts(token: str) -> list[dict]:
    """Fetch all accounts from Copilot Money."""
    result = graphql_request(ACCOUNTS_QUERY, {"filter": None}, token)

    if "errors" in result:
        print(f"GraphQL errors: {json.dumps(result['errors'], indent=2)}")
        sys.exit(1)

    return result.get("data", {}).get("accounts", [])


def fetch_live_balance(token: str, item_id: str, account_id: str) -> Optional[dict]:
    """Fetch live balance for a specific account."""
    result = graphql_request(
        ACCOUNT_LIVE_BALANCE_QUERY,
        {"itemId": item_id, "accountId": account_id},
        token,
    )
    return result.get("data", {}).get("accountLiveBalance")


def fetch_networth(token: str) -> list[dict]:
    """Fetch net worth history."""
    result = graphql_request(NETWORTH_QUERY, {"timeFrame": None}, token)
    return result.get("data", {}).get("networthHistory", [])


# ─── Display ──────────────────────────────────────────────────────────────────

ACCOUNT_TYPE_LABELS = {
    "depository": "Bank Account",
    "credit": "Credit Card",
    "loan": "Loan",
    "investment": "Investment",
    "other": "Other",
}


def display_accounts(accounts: list[dict]) -> None:
    """Pretty-print account balances to the terminal."""
    # Group by type
    by_type: dict[str, list[dict]] = {}
    for acct in accounts:
        if acct.get("isUserHidden") or acct.get("isUserClosed"):
            continue
        acct_type = acct.get("type", "other")
        by_type.setdefault(acct_type, []).append(acct)

    total_assets = 0.0
    total_debt = 0.0

    print("\n" + "=" * 70)
    print("  COPILOT MONEY — ACCOUNT BALANCES")
    print("=" * 70)

    for acct_type in ["depository", "investment", "credit", "loan", "other"]:
        group = by_type.get(acct_type, [])
        if not group:
            continue

        label = ACCOUNT_TYPE_LABELS.get(acct_type, acct_type.title())
        print(f"\n  {label}s")
        print("  " + "-" * 50)

        for acct in sorted(group, key=lambda a: abs(a.get("balance", 0)), reverse=True):
            name = acct.get("name", "Unknown")
            mask = acct.get("mask", "")
            balance = acct.get("liveBalance") or acct.get("balance") or 0
            limit = acct.get("limit")

            mask_str = f" (****{mask})" if mask else ""
            balance_val = float(balance)

            if acct_type in ("credit", "loan"):
                total_debt += abs(balance_val)
                balance_str = f"-${abs(balance_val):,.2f}"
                color = "\033[91m"  # Red
            else:
                total_assets += balance_val
                balance_str = f"${balance_val:,.2f}"
                color = "\033[92m"  # Green

            reset = "\033[0m"
            line = f"  {name}{mask_str}"
            print(f"  {line:<40} {color}{balance_str:>12}{reset}")

            if limit and acct_type == "credit":
                util = abs(balance_val) / float(limit) * 100
                print(f"  {'':>40} Limit: ${float(limit):,.0f} ({util:.0f}% used)")

    print("\n" + "=" * 70)
    print(f"  Total Assets:  \033[92m${total_assets:,.2f}\033[0m")
    print(f"  Total Debt:    \033[91m-${total_debt:,.2f}\033[0m")
    print(f"  Net Worth:     ${total_assets - total_debt:,.2f}")
    print("=" * 70 + "\n")


# ─── Dashboard Integration ────────────────────────────────────────────────────

def push_to_dashboard(accounts: list[dict]) -> None:
    """Push credit card balances to the finance dashboard API."""
    # Map Copilot account names to dashboard account IDs
    ACCOUNT_MAP = {
        "Capital One Venture X": "acc_cap1_venture_x",
        "Capital One Savor": "acc_cap1_savor",
        "Capital One Quicksilver": "acc_cap1_quicksilver",
        "Citi Double Cash": "acc_citi_double_cash",
        "Citi Double Cash Card": "acc_citi_double_cash",
        "Blue Cash Preferred": "acc_amex_bcp",
        "Amex Blue Cash Preferred": "acc_amex_bcp",
        "Blue Cash Everyday": "acc_amex_bce",
        "Amex Blue Cash Everyday": "acc_amex_bce",
        "Chase Ultimate Rewards": "acc_chase_ur",
        "Robinhood Credit Card": "acc_robinhood",
        "Apple Card": "acc_apple_card",
    }

    credit_accounts = [a for a in accounts if a.get("type") == "credit" and not a.get("isUserHidden")]
    updated = 0

    for acct in credit_accounts:
        name = acct.get("name", "")
        dashboard_id = None

        # Try exact match first, then partial match
        for copilot_name, d_id in ACCOUNT_MAP.items():
            if copilot_name.lower() in name.lower() or name.lower() in copilot_name.lower():
                dashboard_id = d_id
                break

        if not dashboard_id:
            print(f"  Skipping unmapped account: {name}")
            continue

        balance = abs(float(acct.get("liveBalance") or acct.get("balance") or 0))
        limit = float(acct.get("limit") or 0)

        payload = json.dumps({
            "accountId": dashboard_id,
            "currentBalance": balance,
            "creditLimit": limit,
        }).encode("utf-8")

        try:
            req = urllib.request.Request(
                f"{DASHBOARD_API_URL}/api/accounts/balances",
                data=payload,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status == 200:
                    print(f"  Updated {name}: ${balance:,.2f}")
                    updated += 1
        except Exception as e:
            print(f"  Failed to update {name}: {e}")

    print(f"\n  Pushed {updated} account balances to dashboard.")


# ─── Export ───────────────────────────────────────────────────────────────────

def export_json(accounts: list[dict], filepath: str) -> None:
    """Export account data as JSON."""
    export = []
    for acct in accounts:
        if acct.get("isUserHidden") or acct.get("isUserClosed"):
            continue
        export.append({
            "name": acct.get("name"),
            "type": acct.get("type"),
            "subType": acct.get("subType"),
            "mask": acct.get("mask"),
            "balance": float(acct.get("liveBalance") or acct.get("balance") or 0),
            "limit": float(acct.get("limit") or 0) if acct.get("limit") else None,
            "lastUpdated": acct.get("latestBalanceUpdate"),
        })

    Path(filepath).write_text(json.dumps(export, indent=2))
    print(f"Exported {len(export)} accounts to {filepath}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract account balances from Copilot Money"
    )
    parser.add_argument("--login", action="store_true", help="Authenticate (get a new token)")
    parser.add_argument("--push", action="store_true", help="Push balances to finance dashboard")
    parser.add_argument("--export", type=str, metavar="FILE", help="Export balances to JSON file")
    parser.add_argument("--json", action="store_true", help="Output as JSON to stdout")
    parser.add_argument("--credit-only", action="store_true", help="Show only credit card accounts")
    args = parser.parse_args()

    # ── Authentication ──
    token = load_token()

    if args.login or not token:
        if not token:
            print("No saved token found. Let's authenticate.\n")

        # Try browser automation first
        print("Attempting browser login (requires: pip install playwright)...")
        browser_token = get_token_from_browser()

        if browser_token:
            save_token(browser_token)
            token = browser_token
            print("Authenticated via browser!")
        else:
            print("Browser automation unavailable. Using manual method.\n")
            token = get_token_manual()
            if token:
                save_token(token)
            else:
                print("No token provided. Exiting.")
                sys.exit(1)

    # ── Fetch Accounts ──
    print("Fetching accounts from Copilot Money...")
    accounts = fetch_accounts(token)

    if not accounts:
        print("No accounts found. Token may be invalid — try: python copilot_balance_fetcher.py --login")
        sys.exit(1)

    if args.credit_only:
        accounts = [a for a in accounts if a.get("type") == "credit"]

    # ── Output ──
    if args.json:
        output = []
        for acct in accounts:
            if acct.get("isUserHidden") or acct.get("isUserClosed"):
                continue
            output.append({
                "name": acct.get("name"),
                "type": acct.get("type"),
                "mask": acct.get("mask"),
                "balance": float(acct.get("liveBalance") or acct.get("balance") or 0),
                "limit": float(acct.get("limit") or 0) if acct.get("limit") else None,
            })
        print(json.dumps(output, indent=2))
    else:
        display_accounts(accounts)

    if args.export:
        export_json(accounts, args.export)

    if args.push:
        print("\nPushing credit card balances to finance dashboard...")
        push_to_dashboard(accounts)


if __name__ == "__main__":
    main()
