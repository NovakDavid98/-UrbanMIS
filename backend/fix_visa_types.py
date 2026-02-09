import psycopg2
import re

# Database connection parameters
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "centralnimozek_cehupo"
DB_USER = "postgres"
DB_PASSWORD = "IDvEg1WH40wVn7aa8MT9haYsbtRhF1PC"

def normalize_visa(visa_type):
    if not visa_type:
        return None
    
    # Trim whitespace
    original = visa_type
    normalized = visa_type.strip()

    # 1. Standardize "Mult" casing
    # Matches 'mult', 'multi', 'MULTI' (case insensitive) at start or anywhere relevant
    # But usually it's "Mult ..." or just "Mult"
    if re.search(r'(?i)\bmulti?\b', normalized):
        normalized = re.sub(r'(?i)\bmulti?\b', 'Mult', normalized)

    # 2. Fix standardized codes D/DO/...
    # Replace backslashes with forward slashes
    normalized = normalized.replace('\\', '/')
    
    # Fix spacing in codes like "D/DO 867" -> "D/DO/867"
    # Pattern: D/DO followed by space instead of slash
    normalized = re.sub(r'(D/DO)\s+(\d+)', r'\1/\2', normalized)
    
    # --- COMPREHENSIVE MAPPING ---

    # DOČASNÁ OCHRANA (Temporary Protection)
    # Matches: D/DO, D\DO, D DO, with or without numbers, Mult/Title prefixes
    # Core patterns: "D[/\\]?DO", "Dočasná", "Docasna"
    if re.search(r'(?i)d[/\\]?do', normalized) or re.search(r'(?i)do[cč]asn[aá]', normalized):
        # Exception: Check if it's NOT something else unexpectedly? 
        # But D/DO is almost exclusively Temprorary Protection in this context.
        normalized = "Dočasná ochrana"
    
    # TRVALÝ POBYT (Permanent Residence)
    # Matches: trvaly, trvalý, tryvali, trvály + pobyt/pobut
    if re.search(r'(?i)trv[aá]l[yýií]', normalized):
        normalized = "Trvalý pobyt"

    # STRPĚNÍ (Visa of Tolerance)
    # Matches: strpeni, sterpen, strpění
    if re.search(r'(?i)s(tr|ter)p[eě]n[ií]?', normalized):
        normalized = "Strpění"

    # DLOUHODOBÝ POBYT (Long-term)
    if re.search(r'(?i)dlouh.*pobyt', normalized) or re.search(r'(?i)dlouh.*trvaj', normalized):
        normalized = "Dlouhodobý pobyt"

    # Cleanup leftover Mults that didn't match above (e.g. just "Mult")
    # If the string is JUST "Mult" or "Multi", keep it standard.
    if re.fullmatch(r'(?i)mult[i]?', normalized):
        normalized = "Mult"
        
    return normalized

def fix_visa_types():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()

        print("# Fixing Visa Types...\n")

        # Get all clients with non-null visa_type
        cur.execute("SELECT id, visa_type FROM clients WHERE visa_type IS NOT NULL")
        rows = cur.fetchall()
        
        updates = 0
        
        for client_id, current_visa in rows:
            new_visa = normalize_visa(current_visa)
            
            if new_visa and new_visa != current_visa:
                # Update DB
                cur.execute("UPDATE clients SET visa_type = %s WHERE id = %s", (new_visa, client_id))
                print(f"Updated: '{current_visa}' -> '{new_visa}'")
                updates += 1

        conn.commit()
        print(f"\nTotal records updated: {updates}")

        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    fix_visa_types()
