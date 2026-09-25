"""
AgriGuard Database Schema Migration
Adds resolution tracking to officer_cases and dataset training provenance to expert_feedback.
Preserves all existing data with zero data loss.
"""
import sqlite3
from pathlib import Path

def migrate():
    db_path = Path(__file__).resolve().parent.parent.parent / "agriguard.db"
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    def add_col_if_missing(table, col, col_type):
        cursor.execute(f"PRAGMA table_info({table})")
        cols = [r[1] for r in cursor.fetchall()]
        if col not in cols:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}")
            print(f"Added {col} to {table}")
        else:
            print(f"{col} already exists in {table}")

    # officer_cases resolution tracking
    add_col_if_missing("officer_cases", "resolved_by_id", "TEXT")
    add_col_if_missing("officer_cases", "resolution_notes", "TEXT")

    # expert_feedback training pipeline provenance
    add_col_if_missing("expert_feedback", "reviewer_role", "TEXT DEFAULT 'EXPERT'")
    add_col_if_missing("expert_feedback", "reviewer_decision", "TEXT DEFAULT 'CONFIRMED'")
    add_col_if_missing("expert_feedback", "corrected_severity", "TEXT")
    add_col_if_missing("expert_feedback", "corrected_stage", "TEXT")
    add_col_if_missing("expert_feedback", "training_state", "TEXT DEFAULT 'training_eligible'")
    add_col_if_missing("expert_feedback", "consent_given", "BOOLEAN DEFAULT 1")
    add_col_if_missing("expert_feedback", "quality_score", "REAL DEFAULT 1.0")
    add_col_if_missing("expert_feedback", "dataset_version", "TEXT DEFAULT 'Dataset-v2'")
    add_col_if_missing("expert_feedback", "original_model_version", "TEXT")

    conn.commit()
    conn.close()
    print("Migration completed successfully!")

if __name__ == "__main__":
    migrate()
