import sqlite3
from pathlib import Path


db_path = Path(__file__).resolve().parent / "company_erp.db"

if not db_path.exists():
    raise FileNotFoundError(
        f"Database file not found: {db_path}\n"
        "Make sure you are using the correct backend folder."
    )

conn = sqlite3.connect(db_path)
cursor = conn.cursor()


def table_exists(table_name):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def column_exists(table_name, column_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    columns = [row[1] for row in cursor.fetchall()]
    return column_name in columns


if not column_exists("sales_commissions", "paid_amount"):
    cursor.execute(
        "ALTER TABLE sales_commissions ADD COLUMN paid_amount FLOAT DEFAULT 0"
    )
    print("Added column: sales_commissions.paid_amount")
else:
    print("Column already exists: sales_commissions.paid_amount")


if not table_exists("commission_payments"):
    cursor.execute(
        """
        CREATE TABLE commission_payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            company_id INTEGER NOT NULL,
            commission_id INTEGER NOT NULL,
            paid_by_user_id INTEGER NOT NULL,

            amount FLOAT NOT NULL,

            payment_date DATE NOT NULL,
            payment_method VARCHAR NOT NULL DEFAULT 'cash',

            remarks TEXT,

            is_active BOOLEAN DEFAULT 1,

            created_at DATETIME,
            updated_at DATETIME,

            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(commission_id) REFERENCES sales_commissions(id),
            FOREIGN KEY(paid_by_user_id) REFERENCES users(id)
        )
        """
    )
    print("Created table: commission_payments")
else:
    print("Table already exists: commission_payments")


conn.commit()
conn.close()

print("Commission payments migration completed successfully.")