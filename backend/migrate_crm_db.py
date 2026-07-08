import sqlite3
from pathlib import Path

DB_PATH = Path("company_erp.db")


def get_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return cursor.fetchall()


def column_names(cursor, table_name):
    return [item[1] for item in get_columns(cursor, table_name)]


def add_column_if_missing(cursor, table_name, column_name, column_sql):
    existing_columns = column_names(cursor, table_name)

    if column_name not in existing_columns:
        print(f"Adding column: {table_name}.{column_name}")
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")
    else:
        print(f"Already exists: {table_name}.{column_name}")


def table_exists(cursor, table_name):
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table_name,),
    )
    return cursor.fetchone() is not None


def sales_rep_is_not_nullable(cursor):
    for column in get_columns(cursor, "sales_leads"):
        # PRAGMA table_info returns:
        # cid, name, type, notnull, default_value, pk
        if column[1] == "sales_rep_user_id":
            return column[3] == 1

    return False


def rebuild_sales_leads_table(cursor):
    print("Rebuilding sales_leads table to allow owner/direct leads...")

    cursor.execute("DROP TABLE IF EXISTS sales_leads_new")

    cursor.execute(
        """
        CREATE TABLE sales_leads_new (
            id INTEGER PRIMARY KEY,
            company_id INTEGER NOT NULL,
            sales_rep_user_id INTEGER,
            created_by_user_id INTEGER NOT NULL,

            client_name VARCHAR NOT NULL,
            client_phone VARCHAR,
            client_email VARCHAR,
            client_company_name VARCHAR,
            client_address TEXT,

            service_interest VARCHAR NOT NULL DEFAULT 'custom_software',
            service_type VARCHAR NOT NULL DEFAULT 'custom_software',
            lead_source VARCHAR,

            status VARCHAR DEFAULT 'new',
            priority VARCHAR DEFAULT 'medium',

            expected_value FLOAT,
            proposal_amount FLOAT,
            final_sale_amount FLOAT,

            recurring_amount FLOAT,
            recurring_cycle VARCHAR,

            follow_up_date DATE,

            proposal_sent_date DATE,
            converted_date DATE,
            delivered_date DATE,
            completed_date DATE,
            lost_date DATE,

            project_required BOOLEAN DEFAULT 0,
            project_created BOOLEAN DEFAULT 0,

            delivery_notes TEXT,
            completion_notes TEXT,
            lost_reason TEXT,

            notes TEXT,
            is_active BOOLEAN DEFAULT 1,

            created_at DATETIME,
            updated_at DATETIME,

            FOREIGN KEY(company_id) REFERENCES companies(id),
            FOREIGN KEY(sales_rep_user_id) REFERENCES users(id),
            FOREIGN KEY(created_by_user_id) REFERENCES users(id)
        )
        """
    )

    columns = [
        "id",
        "company_id",
        "sales_rep_user_id",
        "created_by_user_id",
        "client_name",
        "client_phone",
        "client_email",
        "client_company_name",
        "client_address",
        "service_interest",
        "service_type",
        "lead_source",
        "status",
        "priority",
        "expected_value",
        "proposal_amount",
        "final_sale_amount",
        "recurring_amount",
        "recurring_cycle",
        "follow_up_date",
        "proposal_sent_date",
        "converted_date",
        "delivered_date",
        "completed_date",
        "lost_date",
        "project_required",
        "project_created",
        "delivery_notes",
        "completion_notes",
        "lost_reason",
        "notes",
        "is_active",
        "created_at",
        "updated_at",
    ]

    columns_sql = ", ".join(columns)

    cursor.execute(
        f"""
        INSERT INTO sales_leads_new ({columns_sql})
        SELECT {columns_sql}
        FROM sales_leads
        """
    )

    cursor.execute("DROP TABLE sales_leads")
    cursor.execute("ALTER TABLE sales_leads_new RENAME TO sales_leads")

    cursor.execute("CREATE INDEX IF NOT EXISTS ix_sales_leads_id ON sales_leads(id)")

    print("sales_leads table rebuilt successfully.")


def main():
    if not DB_PATH.exists():
        print("company_erp.db not found. Start backend once first.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        cursor.execute("PRAGMA foreign_keys=OFF")

        if not table_exists(cursor, "sales_leads"):
            print("sales_leads table does not exist. Start backend first.")
            return

        # Add new CRM columns to existing sales_leads table
        add_column_if_missing(cursor, "sales_leads", "client_address", "client_address TEXT")
        add_column_if_missing(
            cursor,
            "sales_leads",
            "service_type",
            "service_type VARCHAR NOT NULL DEFAULT 'custom_software'",
        )
        add_column_if_missing(
            cursor,
            "sales_leads",
            "priority",
            "priority VARCHAR DEFAULT 'medium'",
        )
        add_column_if_missing(cursor, "sales_leads", "proposal_amount", "proposal_amount FLOAT")
        add_column_if_missing(cursor, "sales_leads", "recurring_amount", "recurring_amount FLOAT")
        add_column_if_missing(cursor, "sales_leads", "recurring_cycle", "recurring_cycle VARCHAR")

        add_column_if_missing(
            cursor,
            "sales_leads",
            "proposal_sent_date",
            "proposal_sent_date DATE",
        )
        add_column_if_missing(cursor, "sales_leads", "converted_date", "converted_date DATE")
        add_column_if_missing(cursor, "sales_leads", "delivered_date", "delivered_date DATE")
        add_column_if_missing(cursor, "sales_leads", "completed_date", "completed_date DATE")
        add_column_if_missing(cursor, "sales_leads", "lost_date", "lost_date DATE")

        add_column_if_missing(
            cursor,
            "sales_leads",
            "project_required",
            "project_required BOOLEAN DEFAULT 0",
        )
        add_column_if_missing(
            cursor,
            "sales_leads",
            "project_created",
            "project_created BOOLEAN DEFAULT 0",
        )

        add_column_if_missing(cursor, "sales_leads", "delivery_notes", "delivery_notes TEXT")
        add_column_if_missing(cursor, "sales_leads", "completion_notes", "completion_notes TEXT")
        add_column_if_missing(cursor, "sales_leads", "lost_reason", "lost_reason TEXT")
        add_column_if_missing(
            cursor,
            "sales_leads",
            "is_active",
            "is_active BOOLEAN DEFAULT 1",
        )

        # Allow owner/direct lead by rebuilding sales_leads if sales_rep_user_id is NOT NULL
        if sales_rep_is_not_nullable(cursor):
            rebuild_sales_leads_table(cursor)
        else:
            print("sales_rep_user_id already allows owner/direct leads.")

        # Add commission payment method column
        if table_exists(cursor, "sales_commissions"):
            add_column_if_missing(
                cursor,
                "sales_commissions",
                "payment_method",
                "payment_method VARCHAR",
            )

        # Create CRM projects table
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS crm_projects (
                id INTEGER PRIMARY KEY,
                company_id INTEGER NOT NULL,

                lead_id INTEGER,

                assigned_to_user_id INTEGER,
                created_by_user_id INTEGER NOT NULL,

                title VARCHAR NOT NULL,
                description TEXT,

                project_type VARCHAR NOT NULL DEFAULT 'internal_project',
                priority VARCHAR DEFAULT 'medium',
                status VARCHAR DEFAULT 'ongoing',

                client_name VARCHAR,
                client_company_name VARCHAR,

                project_amount FLOAT DEFAULT 0,
                recurring_amount FLOAT,
                recurring_cycle VARCHAR,

                start_date DATE,
                due_date DATE,
                delivered_date DATE,
                completed_date DATE,

                submission_note TEXT,
                submission_link TEXT,

                admin_remarks TEXT,

                is_active BOOLEAN DEFAULT 1,

                created_at DATETIME,
                updated_at DATETIME,

                FOREIGN KEY(company_id) REFERENCES companies(id),
                FOREIGN KEY(lead_id) REFERENCES sales_leads(id),
                FOREIGN KEY(assigned_to_user_id) REFERENCES users(id),
                FOREIGN KEY(created_by_user_id) REFERENCES users(id)
            )
            """
        )

        cursor.execute("CREATE INDEX IF NOT EXISTS ix_crm_projects_id ON crm_projects(id)")

        conn.commit()
        print("CRM database migration completed successfully.")

    except Exception as error:
        conn.rollback()
        print("Migration failed:", error)

    finally:
        cursor.execute("PRAGMA foreign_keys=ON")
        conn.close()


if __name__ == "__main__":
    main()