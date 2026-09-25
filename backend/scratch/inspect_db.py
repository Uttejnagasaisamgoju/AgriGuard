import sqlite3

def check():
    conn = sqlite3.connect("backend/agriguard.db")
    cur = conn.cursor()
    tables = cur.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    print("TABLES:", [t[0] for t in tables])
    for table_name, in tables:
        cols = cur.execute(f"PRAGMA table_info({table_name})").fetchall()
        print(f"\n{table_name} COLUMNS:")
        for col in cols:
            print(f"  {col[1]} ({col[2]})")

if __name__ == "__main__":
    check()
