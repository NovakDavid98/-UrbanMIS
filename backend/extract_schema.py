import psycopg2
import os

# Database connection parameters from .env
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "centralnimozek_cehupo"
DB_USER = "postgres"
DB_PASSWORD = "IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC"

def get_schema():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()

        # Get all tables in public schema
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        """)
        tables = cur.fetchall()

        print(f"# Database Schema: {DB_NAME}\n")

        for table in tables:
            table_name = table[0]
            print(f"## Table: {table_name}")
            
            # Get columns for the table
            cur.execute("""
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = %s
                ORDER BY ordinal_position;
            """, (table_name,))
            columns = cur.fetchall()

            print("| Column | Type | Nullable | Default |")
            print("|---|---|---|---|")
            for col in columns:
                col_name, data_type, is_nullable, col_default = col
                print(f"| {col_name} | {data_type} | {is_nullable} | {col_default} |")
            
            # Get Foreign Keys
            cur.execute("""
                SELECT
                    kcu.column_name, 
                    ccu.table_name AS foreign_table_name,
                    ccu.column_name AS foreign_column_name 
                FROM 
                    information_schema.key_column_usage AS kcu
                    JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = kcu.constraint_name
                    JOIN information_schema.table_constraints AS tc
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = %s;
            """, (table_name,))
            fks = cur.fetchall()
            
            if fks:
                print("\n**Foreign Keys:**")
                for fk in fks:
                    print(f"- `{fk[0]}` references `{fk[1]}({fk[2]})`")

            print("\n---\n")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_schema()
