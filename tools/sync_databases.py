import sqlite3
from pathlib import Path

backend_db = Path(r"c:\sih3\backend\agriguard.db")
root_db = Path(r"c:\sih3\agriguard.db")

print(f"Backend DB exists: {backend_db.exists()} ({backend_db.stat().st_size} bytes)")
print(f"Root DB exists: {root_db.exists()} ({root_db.stat().st_size} bytes)")

conn1 = sqlite3.connect(backend_db)
conn2 = sqlite3.connect(root_db)

# Check users in root DB not in backend DB
users1 = {row[0]: row for row in conn1.execute("SELECT email, name, role, password_hash, id FROM users").fetchall()}
users2 = {row[0]: row for row in conn2.execute("SELECT email, name, role, password_hash, id FROM users").fetchall()}

print(f"Users in backend DB: {list(users1.keys())}")
print(f"Users in root DB: {list(users2.keys())}")

# If any in root not in backend, copy them over
for email, data in users2.items():
    if email not in users1:
        print(f"Copying user {email} from root to backend...")
        cols = [col[1] for col in conn2.execute("PRAGMA table_info(users)").fetchall()]
        user_row = conn2.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        placeholders = ",".join(["?"] * len(cols))
        conn1.execute(f"INSERT OR IGNORE INTO users ({','.join(cols)}) VALUES ({placeholders})", user_row)

conn1.commit()
conn1.close()
conn2.close()
print("Database user check and sync completed.")
