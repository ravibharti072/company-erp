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


if not table_exists("software_products"):
    cursor.execute(
        """
        CREATE TABLE software_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            company_id INTEGER NOT NULL,
            source_project_id INTEGER,

            software_name VARCHAR NOT NULL,
            software_type VARCHAR NOT NULL DEFAULT 'existing_software',
            description TEXT,

            base_price FLOAT NOT NULL DEFAULT 0,
            setup_charge FLOAT DEFAULT 0,

            recurring_amount FLOAT,
            recurring_cycle VARCHAR,

            version VARCHAR,
            demo_url TEXT,
            documentation_url TEXT,

            status VARCHAR DEFAULT 'active',
            notes TEXT,

            is_active BOOLEAN DEFAULT 1,

            created_at DATETIME,
            updated_at DATETIME,

            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(source_project_id) REFERENCES crm_projects(id)
        )
        """
    )
    print("Created table: software_products")
else:
    print("Table already exists: software_products")


if not column_exists("sales_leads", "software_product_id"):
    cursor.execute(
        "ALTER TABLE sales_leads ADD COLUMN software_product_id INTEGER"
    )
    print("Added column: sales_leads.software_product_id")
else:
    print("Column already exists: sales_leads.software_product_id")


if not column_exists("crm_projects", "software_product_id"):
    cursor.execute(
        "ALTER TABLE crm_projects ADD COLUMN software_product_id INTEGER"
    )
    print("Added column: crm_projects.software_product_id")
else:
    print("Column already exists: crm_projects.software_product_id")


if not column_exists("crm_projects", "converted_to_software_product"):
    cursor.execute(
        "ALTER TABLE crm_projects ADD COLUMN converted_to_software_product BOOLEAN DEFAULT 0"
    )
    print("Added column: crm_projects.converted_to_software_product")
else:
    print("Column already exists: crm_projects.converted_to_software_product")


conn.commit()
conn.close()

print("Software products migration completed successfully.")