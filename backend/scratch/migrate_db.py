import sqlite3
import os
from pathlib import Path

DB_PATHS = [
    Path(r"c:\sih3\backend\agriguard.db"),
    Path(r"c:\sih3\agriguard.db"),
]

def migrate_db(db_path: Path):
    if not db_path.exists():
        print(f"Skipping non-existent DB: {db_path}")
        return

    print(f"\n--- Migrating database: {db_path} ---")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Check sowing_date in farms
    cols = [c[1] for c in cur.execute("PRAGMA table_info(farms)").fetchall()]
    if "sowing_date" not in cols:
        print("Adding sowing_date column to farms...")
        cur.execute("ALTER TABLE farms ADD COLUMN sowing_date DATE")
        conn.commit()
        # If planting_date exists, copy over
        if "planting_date" in cols:
            cur.execute("UPDATE farms SET sowing_date = planting_date WHERE planting_date IS NOT NULL AND sowing_date IS NULL")
            conn.commit()
        print("sowing_date column added successfully.")
    else:
        print("sowing_date column already exists in farms.")

    # 2. Create farm_treatments table
    print("Creating farm_treatments table if not exists...")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS farm_treatments (
        id CHAR(36) PRIMARY KEY,
        farm_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        action_type VARCHAR(100) NOT NULL,
        date DATE NOT NULL,
        description TEXT NOT NULL,
        related_disease VARCHAR(255),
        prediction_id CHAR(36),
        notes TEXT,
        recorded_by_name VARCHAR(255),
        recorded_by_role VARCHAR(50) DEFAULT 'FARMER',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (prediction_id) REFERENCES disease_predictions(id) ON DELETE SET NULL
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_farm_treatments_farm_id ON farm_treatments(farm_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_farm_treatments_user_id ON farm_treatments(user_id)")
    conn.commit()
    print("farm_treatments table ready.")

    # 3. Create farm_reports table
    print("Creating farm_reports table if not exists...")
    cur.execute("""
    CREATE TABLE IF NOT EXISTS farm_reports (
        id CHAR(36) PRIMARY KEY,
        farm_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        report_type VARCHAR(50) DEFAULT 'health_summary',
        period VARCHAR(50) DEFAULT 'all_time',
        file_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500),
        summary_data JSON,
        status VARCHAR(50) DEFAULT 'completed',
        download_count INTEGER DEFAULT 1,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (farm_id) REFERENCES farms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_farm_reports_farm_id ON farm_reports(farm_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_farm_reports_user_id ON farm_reports(user_id)")
    conn.commit()
    print("farm_reports table ready.")

    conn.close()
    print(f"Migration completed for {db_path}")

if __name__ == "__main__":
    for p in DB_PATHS:
        migrate_db(p)
