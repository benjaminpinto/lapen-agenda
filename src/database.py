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
            # Convert SQLite strftime to PostgreSQL date functions
            pg_query = pg_query.replace("strftime('%Y-%m', s.date) = strftime('%Y-%m', 'now')", "DATE_TRUNC('month', s.date) = DATE_TRUNC('month', CURRENT_DATE)")
            pg_query = pg_query.replace("strftime('%Y-%m', date) = strftime('%Y-%m', 'now')", "DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE)")
            # Convert boolean syntax
            pg_query = pg_query.replace('active = TRUE', 'active = true')
            pg_query = pg_query.replace('active = 1', 'active = true')
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
    if os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL'):
        return  # Skip init for PostgreSQL - run schema manually
    
    if not os.path.exists(DATABASE):
        os.makedirs(os.path.dirname(DATABASE), exist_ok=True)
        conn = sqlite3.connect(DATABASE)
        with open(os.path.join(os.path.dirname(__file__), "database", "schema.sql"), "r") as f:
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