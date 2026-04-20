#!/usr/bin/env python3
"""
Copilot Money Balance Extractor
Reads account balances directly from Copilot Money's local SQLite database
on macOS. No API keys or authentication needed.

Falls back to the web GraphQL API if the local DB isn't found.

Usage:
  python copilot_balance_fetcher.py              # show all balances
  python copilot_balance_fetcher.py --push       # push to finance dashboard
  python copilot_balance_fetcher.py --json       # JSON output
  python copilot_balance_fetcher.py --credit-only
  python copilot_balance_fetcher.py --export balances.json
  python copilot_balance_fetcher.py --web        # force web API mode
"""

import json
import sqlite3
import sys
import os
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

# ─── Configuration ────────────────────────────────────────────────────────────

COPILOT_DB_PATH = Path.home() / "Library" / "Group Containers" / "group.com.copilot.production" / "database" / "CopilotDB.sqlite"
COPILOT_API_URL = "https://app.copilot.money/api/graphql"
TOKEN_FILE = Path.home() / ".config" / "copilot-money" / "token.txt"
DASHBOARD_API_URL = os.environ.get("DASHBOARD_URL", "http://localhost:3000")

# Dashboard account ID mapping (Copilot account name → dashboard ID)
ACCOUNT_MAP = {
    "capital one venture x": "acc_cap1_venture_x",
    "venture x":             "acc_cap1_venture_x",
    "capital one savor":     "acc_cap1_savor",
    "savor":                 "acc_cap1_savor",
    "capital one quicksilver": "acc_cap1_quicksilver",
    "quicksilver":           "acc_cap1_quicksilver",
    "citi double cash":      "acc_citi_double_cash",
    "citi double cash card": "acc_citi_double_cash",
    "blue cash preferred":   "acc_amex_bcp",
    "amex blue cash preferred": "acc_amex_bcp",
    "blue cash everyday":    "acc_amex_bce",
    "amex blue cash everyday": "acc_amex_bce",
    "chase ultimate rewards": "acc_chase_ur",
    "robinhood credit card": "acc_robinhood",
    "robinhood":             "acc_robinhood",
    "apple card":            "acc_apple_card",
}


# ═══════════════════════════════════════════════════════════════════════════════
#  LOCAL SQLITE DATABASE MODE (preferred — no auth needed)
# ═══════════════════════════════════════════════════════════════════════════════

def find_copilot_db() -> Optional[Path]:
    """Locate the Copilot Money SQLite database on macOS."""
    if COPILOT_DB_PATH.exists():
        return COPILOT_DB_PATH

    # Search common locations
    search_paths = [
        Path.home() / "Library" / "Group Containers",
        Path.home() / "Library" / "Containers",
    ]
    for base in search_paths:
        if not base.exists():
            continue
        for db_file in base.rglob("CopilotDB.sqlite"):
            return db_file

    return None


def fetch_accounts_from_db(db_path: Path) -> list[dict]:
    """
    Read latest account balances from the local Copilot Money SQLite database.

    The DB has:
      - Transactions table: id, date, name, amount, account_id, category_id, ...
      - accountDailyBalance table: date, account_id, current_balance, available_balance

    Account names come from correlating account_id with transaction data.
    """
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    accounts = []

    # First, get all tables to understand what's available
    tables = [row[0] for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()]

    print(f"  Database tables: {', '.join(tables)}")

    # ── Get latest balance per account from accountDailyBalance ──
    if "accountDailyBalance" in tables:
        rows = conn.execute("""
            SELECT
                b.account_id,
                b.current_balance,
                b.available_balance,
                b."limit",
                b.date
            FROM accountDailyBalance b
            INNER JOIN (
                SELECT account_id, MAX(date) as max_date
                FROM accountDailyBalance
                GROUP BY account_id
            ) latest ON b.account_id = latest.account_id AND b.date = latest.max_date
            ORDER BY ABS(b.current_balance) DESC
        """).fetchall()

        balance_map = {}
        for row in rows:
            balance_map[row["account_id"]] = {
                "current_balance": row["current_balance"],
                "available_balance": row["available_balance"],
                "limit": row["limit"],
                "date": row["date"],
            }
    else:
        balance_map = {}

    # ── Try to get account names from Transactions table ──
    # The DB has no accounts table, so we infer a label from the most
    # common payment/autopay transaction name tied to each account_id.
    account_names = {}
    if "Transactions" in tables:
        # For each account, grab the most descriptive internal_transfer name
        # (autopay rows usually carry the card/bank name, e.g. "CAPITAL ONE AUTOPAY").
        name_rows = conn.execute("""
            SELECT account_id,
                   name,
                   COUNT(*) as cnt
            FROM Transactions
            WHERE user_deleted = 0
              AND account_id IS NOT NULL
              AND type = 'internal_transfer'
            GROUP BY account_id, name
            ORDER BY account_id, cnt DESC
        """).fetchall()

        for row in name_rows:
            acct_id = row["account_id"]
            if acct_id not in account_names:
                account_names[acct_id] = row["name"]  # most-common transfer name

    # ── Build account list ──
    for acct_id, bal_data in balance_map.items():
        balance   = bal_data["current_balance"] or 0
        available = bal_data["available_balance"]
        limit_val = bal_data["limit"]

        # A non-null limit column is the definitive credit-card signal.
        # Copilot stores credit balances as positive owed amounts.
        if limit_val is not None:
            acct_type = "credit"
        elif available is not None and available != balance:
            acct_type = "credit"
            limit_val = balance + available  # derive limit if missing
        else:
            acct_type = "depository"

        # Build a human-readable label from the transfer-name hint, or fall
        # back to a shortened account ID so the report is still readable.
        raw_label = account_names.get(acct_id, "")
        if raw_label:
            name = raw_label
        else:
            name = f"Account …{acct_id[-8:]}"

        accounts.append({
            "id": acct_id,
            "name": name,
            "type": acct_type,
            "balance": float(balance),
            "liveBalance": float(balance),
            "limit": float(limit_val) if limit_val else None,
            "mask": "",
            "lastUpdated": bal_data["date"],
            "source": "local_db",
        })

    # ── Also scan for accounts only in Transactions (no balance entry) ──
    for acct_id in account_names:
        if acct_id not in balance_map:
            # Estimate balance from transaction sums (approximate)
            try:
                result = conn.execute("""
                    SELECT SUM(amount) as total
                    FROM Transactions
                    WHERE account_id = ? AND user_deleted = 0
                """, (acct_id,)).fetchone()
                if result and result["total"]:
                    accounts.append({
                        "id": acct_id,
                        "name": account_names.get(acct_id, acct_id),
                        "type": "unknown",
                        "balance": float(result["total"]),
                        "liveBalance": float(result["total"]),
                        "limit": None,
                        "mask": "",
                        "lastUpdated": None,
                        "source": "estimated_from_transactions",
                    })
            except Exception:
                pass

    conn.close()

    # ── Dump full schema for debugging on first run ──
    if not accounts:
        print("\n  No balances found. Dumping full DB schema for debugging:")
        conn2 = sqlite3.connect(str(db_path))
        for tbl in tables:
            cols = conn2.execute(f"PRAGMA table_info({tbl})").fetchall()
            col_names = [c[1] for c in cols]
            count = conn2.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            print(f"    {tbl} ({count} rows): {', '.join(col_names)}")
        conn2.close()

    return accounts


# ═══════════════════════════════════════════════════════════════════════════════
#  WEB GRAPHQL API MODE (fallback — requires auth token)
# ═══════════════════════════════════════════════════════════════════════════════

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


def load_token() -> Optional[str]:
    """Load saved auth token from disk or env."""
    if TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text().strip()
        if token:
            return token
    return os.environ.get("COPILOT_TOKEN")


def save_token(token: str) -> None:
    """Save auth token to disk."""
    TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    TOKEN_FILE.write_text(token)
    TOKEN_FILE.chmod(0o600)
    print(f"  Token saved to {TOKEN_FILE}")


def get_token_from_browser() -> Optional[str]:
    """Open Copilot Money login in browser and capture the auth token."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return None

    print("\n  Opening Copilot Money login page...")
    print("  Log in with your account. The token will be captured automatically.\n")

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

        print("  Waiting for you to log in...")
        for _ in range(120):
            if captured_token:
                break
            time.sleep(1)

        browser.close()

    return captured_token


def get_token_manual() -> str:
    """Prompt user to paste their auth token manually."""
    print("""
  ┌─────────────────────────────────────────────────────────────┐
  │         How to get your Copilot Money auth token            │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  1. Open https://app.copilot.money in Chrome                │
  │  2. Log in to your account                                  │
  │  3. Open DevTools (F12) -> Network tab                      │
  │  4. Filter by "graphql"                                     │
  │  5. Click any request -> Headers tab                        │
  │  6. Copy the "Authorization: Bearer ..." value              │
  │     (just the part after "Bearer ")                         │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
""")
    token = input("  Paste your Bearer token here: ").strip()
    if token.startswith("Bearer "):
        token = token[7:]
    return token


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
            print("  ERROR: Token expired or invalid. Please re-authenticate.")
            if TOKEN_FILE.exists():
                TOKEN_FILE.unlink()
            sys.exit(1)
        print(f"  HTTP {e.code}: {body}")
        sys.exit(1)


def fetch_accounts_from_web(token: str) -> list[dict]:
    """Fetch all accounts from Copilot Money's web API."""
    result = graphql_request(ACCOUNTS_QUERY, {"filter": None}, token)
    if "errors" in result:
        print(f"  GraphQL errors: {json.dumps(result['errors'], indent=2)}")
        sys.exit(1)
    accounts = result.get("data", {}).get("accounts", [])
    for acct in accounts:
        acct["source"] = "web_api"
    return accounts


def authenticate_web() -> str:
    """Get a web API token interactively."""
    print("  Attempting browser login (requires: pip install playwright)...")
    browser_token = get_token_from_browser()
    if browser_token:
        save_token(browser_token)
        print("  Authenticated via browser!")
        return browser_token

    print("  Browser automation unavailable. Using manual method.\n")
    token = get_token_manual()
    if token:
        save_token(token)
        return token

    print("  No token provided. Exiting.")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════════
#  DISPLAY
# ═══════════════════════════════════════════════════════════════════════════════

ACCOUNT_TYPE_LABELS = {
    "depository": "Bank Account",
    "credit": "Credit Card",
    "loan": "Loan",
    "investment": "Investment",
    "other": "Other",
    "unknown": "Unknown",
}


def display_accounts(accounts: list[dict]) -> None:
    """Pretty-print account balances to the terminal."""
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
    source = accounts[0].get("source", "unknown") if accounts else "unknown"
    print(f"  Source: {'Local SQLite DB' if source == 'local_db' else 'Web API'}")
    print("=" * 70)

    for acct_type in ["depository", "investment", "credit", "loan", "other", "unknown"]:
        group = by_type.get(acct_type, [])
        if not group:
            continue

        label = ACCOUNT_TYPE_LABELS.get(acct_type, acct_type.title())
        print(f"\n  {label}s")
        print("  " + "-" * 50)

        for acct in sorted(group, key=lambda a: abs(a.get("balance", 0) or 0), reverse=True):
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
            updated = f"  (as of {acct.get('lastUpdated', 'N/A')})" if acct.get("lastUpdated") else ""
            line = f"  {name}{mask_str}"
            print(f"  {line:<40} {color}{balance_str:>12}{reset}{updated}")

            if limit and acct_type == "credit":
                util = abs(balance_val) / float(limit) * 100
                print(f"  {'':>40} Limit: ${float(limit):,.0f} ({util:.0f}% used)")

    print("\n" + "=" * 70)
    print(f"  Total Assets:  \033[92m${total_assets:,.2f}\033[0m")
    print(f"  Total Debt:    \033[91m-${total_debt:,.2f}\033[0m")
    print(f"  Net Worth:     ${total_assets - total_debt:,.2f}")
    print("=" * 70 + "\n")


# ═══════════════════════════════════════════════════════════════════════════════
#  DASHBOARD INTEGRATION
# ═══════════════════════════════════════════════════════════════════════════════

def match_dashboard_id(name: str) -> Optional[str]:
    """Match a Copilot account name to a dashboard account ID."""
    name_lower = name.lower()
    for key, dashboard_id in ACCOUNT_MAP.items():
        if key in name_lower or name_lower in key:
            return dashboard_id
    return None


def push_to_dashboard(accounts: list[dict]) -> None:
    """Push credit card balances to the finance dashboard API."""
    credit_accounts = [
        a for a in accounts
        if a.get("type") == "credit" and not a.get("isUserHidden")
    ]
    updated = 0

    for acct in credit_accounts:
        name = acct.get("name", "")
        dashboard_id = match_dashboard_id(name)

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


def export_json(accounts: list[dict], filepath: str) -> None:
    """Export account data as JSON."""
    export = []
    for acct in accounts:
        if acct.get("isUserHidden") or acct.get("isUserClosed"):
            continue
        export.append({
            "name": acct.get("name"),
            "type": acct.get("type"),
            "mask": acct.get("mask"),
            "balance": float(acct.get("liveBalance") or acct.get("balance") or 0),
            "limit": float(acct.get("limit") or 0) if acct.get("limit") else None,
            "lastUpdated": acct.get("lastUpdated") or acct.get("latestBalanceUpdate"),
        })
    Path(filepath).write_text(json.dumps(export, indent=2))
    print(f"  Exported {len(export)} accounts to {filepath}")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Extract account balances from Copilot Money (local DB or web API)"
    )
    parser.add_argument("--web", action="store_true", help="Force web API mode (skip local DB)")
    parser.add_argument("--login", action="store_true", help="Re-authenticate for web API mode")
    parser.add_argument("--push", action="store_true", help="Push balances to finance dashboard")
    parser.add_argument("--export", type=str, metavar="FILE", help="Export balances to JSON file")
    parser.add_argument("--json", action="store_true", help="Output as JSON to stdout")
    parser.add_argument("--credit-only", action="store_true", help="Show only credit card accounts")
    parser.add_argument("--db-path", type=str, help="Custom path to CopilotDB.sqlite")
    parser.add_argument("--schema", action="store_true", help="Dump DB schema and exit (debug)")
    args = parser.parse_args()

    # ── Try local SQLite DB first ──
    accounts = []
    db_path = Path(args.db_path) if args.db_path else find_copilot_db()

    if args.schema and db_path:
        print(f"\n  Database: {db_path}\n")
        conn = sqlite3.connect(str(db_path))
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()]
        for tbl in tables:
            cols = conn.execute(f"PRAGMA table_info({tbl})").fetchall()
            col_names = [f"{c[1]} ({c[2]})" for c in cols]
            count = conn.execute(f"SELECT COUNT(*) FROM {tbl}").fetchone()[0]
            print(f"  {tbl} ({count} rows):")
            for cn in col_names:
                print(f"    - {cn}")
            print()
        conn.close()
        return

    if db_path and not args.web:
        print(f"  Found Copilot Money DB: {db_path}")
        print("  Reading balances from local database...\n")
        accounts = fetch_accounts_from_db(db_path)

    # ── Fall back to web API ──
    if not accounts:
        if not args.web and db_path:
            print("  No balances found in local DB.")
        if not db_path and not args.web:
            print("  Copilot Money database not found locally.")
            print("  Expected at: ~/Library/Group Containers/group.com.copilot.production/database/CopilotDB.sqlite")
            print("  Tip: Make sure Copilot Money macOS app is installed and has synced.\n")

        print("  Falling back to web API...\n")

        token = load_token()
        if args.login or not token:
            token = authenticate_web()

        print("  Fetching accounts from Copilot Money web API...")
        accounts = fetch_accounts_from_web(token)

        if not accounts:
            print("  No accounts found. Try: python copilot_balance_fetcher.py --login")
            sys.exit(1)

    # ── Filter ──
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
