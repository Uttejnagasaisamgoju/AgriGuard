import sqlite3
from pathlib import Path

DB_PATHS = [
    Path(r"c:\sih3\backend\agriguard.db"),
    Path(r"c:\sih3\agriguard.db"),
]

def migrate_db(db_path: Path):
    if not db_path.exists():
        print(f"Skipping non-existent DB: {db_path}")
        return

    print(f"\n--- Migrating push notification tables for: {db_path} ---")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Create push_subscriptions table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS push_subscriptions (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh TEXT,
        auth TEXT,
        subscription_type VARCHAR(50) DEFAULT 'web_push',
        device_info VARCHAR(255),
        is_active BOOLEAN DEFAULT 1,
        last_used_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON push_subscriptions(endpoint)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_subs_is_active ON push_subscriptions(is_active)")
    conn.commit()
    print("push_subscriptions table ready.")

    # 2. Create notification_preferences table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS notification_preferences (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL UNIQUE,
        push_enabled BOOLEAN DEFAULT 1,
        disease_alerts BOOLEAN DEFAULT 1,
        expert_messages BOOLEAN DEFAULT 1,
        officer_updates BOOLEAN DEFAULT 1,
        weather_alerts BOOLEAN DEFAULT 1,
        system_updates BOOLEAN DEFAULT 1,
        sound_enabled BOOLEAN DEFAULT 1,
        vibration_enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_notif_pref_user_id ON notification_preferences(user_id)")
    conn.commit()
    print("notification_preferences table ready.")

    # 3. Create push_delivery_logs table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS push_delivery_logs (
        id CHAR(36) PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        subscription_id CHAR(36),
        notification_type VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        status_code INTEGER,
        error_message TEXT,
        endpoint_url VARCHAR(500),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (subscription_id) REFERENCES push_subscriptions(id) ON DELETE SET NULL
    )
    """)
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_logs_user_id ON push_delivery_logs(user_id)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_logs_status ON push_delivery_logs(status)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_push_logs_created_at ON push_delivery_logs(created_at)")
    conn.commit()
    print("push_delivery_logs table ready.")

    conn.close()
    print(f"Migration completed for {db_path}")

if __name__ == "__main__":
    for p in DB_PATHS:
        migrate_db(p)
