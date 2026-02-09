import psycopg2

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "centralnimozek_cehupo"
DB_USER = "postgres"
DB_PASSWORD = "IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC"

STANDARD_TYPES = [
    "Dočasná ochrana",
    "Mult",
    "Trvalý pobyt",
    "Strpění",
    "Dlouhodobý pobyt",
]

def report_unique():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()
        
        cur.execute("SELECT visa_type, COUNT(*) as count FROM clients GROUP BY visa_type ORDER BY count DESC")
        rows = cur.fetchall()
        
        print("# Non-Standard Visa Types Report\n")
        print("| Visa Type | Count | Status |")
        print("|---|---|---|")
        
        outliers = []
        
        for vtype, count in rows:
            if vtype is None:
                continue # Skip nulls for now or mark as Empty
            
            if vtype in STANDARD_TYPES:
                # print(f"| {vtype} | {count} | Standard |") # Skip standard to reduce noise
                pass
            else:
                print(f"| {vtype} | {count} | **Unique/Outlier** |")
                outliers.append((vtype, count))
                
        print("\n\n## Summary")
        print(f"Total Unique variations found: {len(outliers)}")
        
        if outliers:
             print("\n### Next Steps")
             print("We need to decide what to do with these. Potentially map them to standard types or keep them if they are distinct legal statuses.")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    report_unique()
