import psycopg2
import os

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "centralnimozek_cehupo"
DB_USER = "postgres"
DB_PASSWORD = "IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC"

def analyze_visa_types():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()

        print("# Visa Type Analysis\n")

        # 1. Aggregation of variations
        print("## Visa Type Distribution (Count by Variation)\n")
        cur.execute("""
            SELECT visa_type, COUNT(*) as count 
            FROM clients 
            GROUP BY visa_type 
            ORDER BY count DESC;
        """)
        stats = cur.fetchall()

        print("| Visa Type Variation | Count |")
        print("|---|---|")
        for visa_type, count in stats:
            # Handle None/Null
            display_type = visa_type if visa_type is not None else "[NULL]"
            # Escape pipes if necessary, though unlikely in visa names, good practice
            display_type = str(display_type).replace("|", "\|")
            print(f"| {display_type} | {count} |")
        
        print("\n---\n")

        # 2. Detailed List (Limit to first 50 to avoid gigantic output if database is huge, 
        # but user asked for 'all', so I will output a separate section or file if needed.
        # For this script run, I'll print them all if count is < 200, else summary.)
        
        total_clients = sum(x[1] for x in stats)
        print(f"**Total Clients:** {total_clients}\n")

        print("## Client List (Name - Visa Type)\n")
        cur.execute("""
            SELECT first_name, last_name, visa_type 
            FROM clients 
            ORDER BY last_name, first_name;
        """)
        clients = cur.fetchall()

        print("| First Name | Last Name | Visa Type |")
        print("|---|---|---|")
        for fname, lname, vtype in clients:
             display_vtype = vtype if vtype is not None else ""
             print(f"| {fname} | {lname} | {display_vtype} |")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    analyze_visa_types()
