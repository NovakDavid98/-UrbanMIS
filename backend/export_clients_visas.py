import psycopg2

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "centralnimozek_cehupo"
DB_USER = "postgres"
DB_PASSWORD = "IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC"

def export_visas():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()
        
        # Query all clients
        cur.execute("SELECT first_name, last_name, visa_type FROM clients ORDER BY last_name, first_name")
        rows = cur.fetchall()
        
        output_file = "all_clients_visas.txt"
        with open(output_file, "w") as f:
            for fname, lname, vtype in rows:
                # Handle None/Null
                vtype_str = vtype if vtype is not None else "[NULL]"
                # Format: First Last - VisaType
                f.write(f"{fname} {lname} - {vtype_str}\n")
                
        cur.close()
        conn.close()
        print(f"Successfully exported {len(rows)} records to {output_file}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    export_visas()
