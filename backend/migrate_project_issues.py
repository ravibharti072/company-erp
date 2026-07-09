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


if not table_exists("project_issues"):
    cursor.execute(
        """
        CREATE TABLE project_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            company_id INTEGER NOT NULL,
            project_id INTEGER,
            created_by_user_id INTEGER NOT NULL,

            issue_type VARCHAR NOT NULL DEFAULT 'project_issue',

            title VARCHAR NOT NULL,
            description TEXT,

            priority VARCHAR DEFAULT 'medium',
            status VARCHAR DEFAULT 'open',

            remarks TEXT,

            is_active BOOLEAN DEFAULT 1,

            created_at DATETIME,
            updated_at DATETIME,

            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(project_id) REFERENCES crm_projects(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        )
        """
    )
    print("Created table: project_issues")
else:
    print("Table already exists: project_issues")


conn.commit()
conn.close()

print("Project issues migration completed successfully.")
