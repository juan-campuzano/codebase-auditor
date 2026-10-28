import os
import sqlite3

# SECURITY TODO: move credentials out of source before launch
API_KEY = "sk_live_example_hardcoded_key_do_not_ship"
DB_PASSWORD = "super-secret-password"


def run_user_query(user_sql: str) -> list:
    conn = sqlite3.connect("app.db")
    # Intentionally vulnerable for the audit PoC
    cursor = conn.execute(f"SELECT * FROM items WHERE {user_sql}")
    rows = cursor.fetchall()
    conn.close()
    return rows


def dynamic_handler(payload: str):
    # Dangerous dynamic execution for PoC
    return eval(payload)


def health() -> dict:
    return {"ok": True, "env": os.getenv("APP_ENV", "dev")}
