"""
AgriGuard Database Migration: Chat Schema Enhancement
Safely adds missing columns and indexes to `ai_conversations` and `ai_messages`
without dropping tables or losing any existing conversation history.
"""
import sqlite3
import os
import sys
from pathlib import Path

def migrate(db_path: str):
    print(f"[*] Inspecting database at: {db_path}")
    if not os.path.exists(db_path):
        print(f"[!] Database file not found: {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Migrate ai_conversations
    cur.execute("PRAGMA table_info(ai_conversations)")
    conv_cols = {row[1] for row in cur.fetchall()}
    print(f"[*] Existing columns in ai_conversations: {conv_cols}")

    if "status" not in conv_cols:
        print("[+] Adding 'status' to ai_conversations...")
        cur.execute("ALTER TABLE ai_conversations ADD COLUMN status VARCHAR(50) DEFAULT 'active'")

    if "last_message_at" not in conv_cols:
        print("[+] Adding 'last_message_at' to ai_conversations...")
        cur.execute("ALTER TABLE ai_conversations ADD COLUMN last_message_at DATETIME")
        # Populate initial last_message_at from updated_at or created_at
        cur.execute("UPDATE ai_conversations SET last_message_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) WHERE last_message_at IS NULL")

    # 2. Migrate ai_messages
    cur.execute("PRAGMA table_info(ai_messages)")
    msg_cols = {row[1] for row in cur.fetchall()}
    print(f"[*] Existing columns in ai_messages: {msg_cols}")

    if "sender_type" not in msg_cols:
        print("[+] Adding 'sender_type' to ai_messages...")
        cur.execute("ALTER TABLE ai_messages ADD COLUMN sender_type VARCHAR(30) DEFAULT 'USER'")
        # Update existing records: if role == 'assistant', sender_type = 'AI_ASSISTANT', else 'USER'
        cur.execute("UPDATE ai_messages SET sender_type = CASE WHEN role = 'assistant' THEN 'AI_ASSISTANT' WHEN role = 'system' THEN 'SYSTEM' ELSE 'USER' END WHERE sender_type IS NULL OR sender_type = 'USER'")

    if "role_context" not in msg_cols:
        print("[+] Adding 'role_context' to ai_messages...")
        cur.execute("ALTER TABLE ai_messages ADD COLUMN role_context VARCHAR(30) DEFAULT 'FARMER'")

    if "model" not in msg_cols:
        print("[+] Adding 'model' to ai_messages...")
        cur.execute("ALTER TABLE ai_messages ADD COLUMN model VARCHAR(100)")
        cur.execute("UPDATE ai_messages SET model = model_version WHERE model IS NULL AND model_version IS NOT NULL")

    if "metadata" not in msg_cols:
        print("[+] Adding 'metadata' to ai_messages...")
        cur.execute("ALTER TABLE ai_messages ADD COLUMN metadata JSON")

    # 3. Create indexes
    try:
        cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_conversations_user_id ON ai_conversations(user_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_conversations_last_message_at ON ai_conversations(last_message_at)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_messages_conversation_id ON ai_messages(conversation_id)")
        cur.execute("CREATE INDEX IF NOT EXISTS ix_ai_messages_created_at ON ai_messages(created_at)")
    except Exception as e:
        print(f"[!] Index creation note: {e}")

    conn.commit()

    # Verify counts
    conv_count = cur.execute("SELECT count(*) FROM ai_conversations").fetchone()[0]
    msg_count = cur.execute("SELECT count(*) FROM ai_messages").fetchone()[0]
    conn.close()

    print(f"[SUCCESS] Migration complete! Conversations: {conv_count}, Messages: {msg_count}")


if __name__ == "__main__":
    db_file = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "agriguard.db")
    migrate(os.path.abspath(db_file))
