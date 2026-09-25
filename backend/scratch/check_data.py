import sqlite3

def check_data():
    conn = sqlite3.connect("backend/agriguard.db")
    cur = conn.cursor()
    users = cur.execute("SELECT id, name, email, role FROM users").fetchall()
    print("USERS:")
    for u in users:
        print(" ", u)
    
    farms = cur.execute("SELECT id, user_id, name, crop_type, planting_date FROM farms").fetchall()
    print("\nFARMS:")
    for f in farms:
        print(" ", f)

    preds = cur.execute("SELECT id, user_id, farm_id, primary_disease, overall_confidence, created_at FROM disease_predictions").fetchall()
    print("\nPREDICTIONS:")
    for p in preds:
        print(" ", p)

if __name__ == "__main__":
    check_data()
