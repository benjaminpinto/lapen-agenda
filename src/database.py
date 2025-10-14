import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance', 'app.db')

class DatabaseWrapper:
    def __init__(self, conn, is_postgres=False):
        self.conn = conn
        self.is_postgres = is_postgres
        if is_postgres:
            self.cursor = conn.cursor()
    
    def execute(self, query, params=()):
        if self.is_postgres:
            # Convert ? placeholders to %s for PostgreSQL
            pg_query = query.replace('?', '%s')
            
            # Convert SQLite date/time functions to PostgreSQL
            pg_query = pg_query.replace("date('now')", "CURRENT_DATE")
            pg_query = pg_query.replace("time('now')", "CURRENT_TIME")
            pg_query = pg_query.replace("datetime('now')", "CURRENT_TIMESTAMP")
            
            # Convert SQLite strftime to PostgreSQL date functions
            pg_query = pg_query.replace("strftime('%Y-%m', s.date) = strftime('%Y-%m', 'now')", "DATE_TRUNC('month', s.date) = DATE_TRUNC('month', CURRENT_DATE)")
            pg_query = pg_query.replace("strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)")
            
            # Handle date comparisons
            pg_query = pg_query.replace("date > date('now')", "date > CURRENT_DATE")
            pg_query = pg_query.replace("date = date('now')", "date = CURRENT_DATE")
            pg_query = pg_query.replace("start_time > time('now')", "start_time > CURRENT_TIME")
            
            # Convert string concatenation for PostgreSQL compatibility
            import re
            # Handle || operator with CAST for better compatibility
            pg_query = re.sub(r"'([^']+)' \|\| ([a-zA-Z_][a-zA-Z0-9_.]*)", r"CONCAT('\1', CAST(\2 AS TEXT))", pg_query)
            pg_query = re.sub(r"([a-zA-Z_][a-zA-Z0-9_.]*) \|\| '([^']+)'", r"CONCAT(CAST(\1 AS TEXT), '\2')", pg_query)
            
            # Convert boolean literals
            pg_query = pg_query.replace('= TRUE', '= true')
            pg_query = pg_query.replace('= FALSE', '= false')
            pg_query = pg_query.replace('active = 1', 'active = true')
            pg_query = pg_query.replace('active = 0', 'active = false')
            
            # Convert AUTOINCREMENT to SERIAL (though this should be in schema)
            pg_query = pg_query.replace('AUTOINCREMENT', 'SERIAL')
            
            # Handle CAST compatibility
            pg_query = pg_query.replace('CAST(', 'CAST(')
            
            # Ensure proper text casting for PostgreSQL
            pg_query = pg_query.replace('AS TEXT', 'AS VARCHAR')
            
            self.cursor.execute(pg_query, params)
            return self.cursor
        else:
            return self.conn.execute(query, params)
    
    def commit(self):
        self.conn.commit()
    
    def close(self):
        if self.is_postgres:
            self.cursor.close()
        self.conn.close()

def init_db():
    postgres_url = os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL')
    if postgres_url:
        return  # Skip init for PostgreSQL - run schema manually
    
    if not os.path.exists(DATABASE):
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        conn = sqlite3.connect(DATABASE)
        
        # Load main schema
        with open(os.path.join(os.path.dirname(__file__), "database", "schema.sql"), "r") as f:
            conn.executescript(f.read())
        
        # Load betting schema if exists
        betting_schema = os.path.join(os.path.dirname(__file__), "database", "betting_schema_sqlite.sql")
        if os.path.exists(betting_schema):
            with open(betting_schema, "r") as f:
                conn.executescript(f.read())
        
        # Load payment logs schema if exists
        payment_schema = os.path.join(os.path.dirname(__file__), "database", "payment_logs_schema_sqlite.sql")
        if os.path.exists(payment_schema):
            with open(payment_schema, "r") as f:
                conn.executescript(f.read())
        
        conn.close()

def get_db():
    postgres_url = os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL')
    if postgres_url:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(postgres_url, cursor_factory=RealDictCursor)
        return DatabaseWrapper(conn, is_postgres=True)
    else:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        return DatabaseWrapper(conn, is_postgres=False)