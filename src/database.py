import sqlite3
import os

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'instance', 'app.db')

def init_db():
    if os.environ.get('POSTGRES_URL'):
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
        return conn
    else:
        conn = sqlite3.connect(DATABASE)
        conn.row_factory = sqlite3.Row
        return conn