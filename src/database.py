import os
import time

import psycopg2
from psycopg2.extras import RealDictCursor


def init_db():
    postgres_url = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL')
    if not postgres_url:
        raise ValueError('DATABASE_URL environment variable is required')
    
    # Wait for PostgreSQL to be ready
    for attempt in range(30):
        try:
            conn = psycopg2.connect(postgres_url, cursor_factory=RealDictCursor)
            conn.autocommit = True
            cursor = conn.cursor()
            
            # Check if already initialized
            cursor.execute("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')")
            if cursor.fetchone()['exists']:
                cursor.close()
                conn.close()
                return
            
            # Run PostgreSQL migrations in correct order
            migrations = [
                'database/postgres_schema.sql',
                'database/betting_schema_postgres.sql',
                'database/payment_logs_schema_postgres.sql',
                'database/migrations/ranking_schema_postgres.sql',
                'database/migrations/add_match_statistics_postgres.sql',
                'database/migrations/005_challenges_schema.sql'
            ]
            
            for migration_file in migrations:
                migration_path = os.path.join(os.path.dirname(__file__), migration_file)
                if os.path.exists(migration_path):
                    with open(migration_path, 'r') as f:
                        sql = f.read()
                        # Split by semicolon and execute each statement separately
                        statements = [s.strip() for s in sql.split(';') if s.strip()]
                        for statement in statements:
                            try:
                                cursor.execute(statement)
                            except psycopg2.Error as e:
                                # Skip if already exists
                                if 'already exists' not in str(e):
                                    print(f"Error in {migration_file}: {e}")
                                    raise
            
            cursor.close()
            conn.close()
            return
        except psycopg2.OperationalError:
            if attempt == 29:
                raise
            time.sleep(1)

class DBConnection:
    def __init__(self, conn):
        self.conn = conn
        self._cursor = None
    
    def cursor(self):
        if not self._cursor:
            self._cursor = self.conn.cursor()
        return self._cursor
    
    def execute(self, query, params=None):
        cursor = self.cursor()
        if params is None:
            cursor.execute(query)
        else:
            cursor.execute(query, params)
        return cursor
    
    def commit(self):
        self.conn.commit()
    
    def close(self):
        if self._cursor:
            self._cursor.close()
        self.conn.close()

def get_db():
    postgres_url = os.environ.get('DATABASE_URL') or os.environ.get('POSTGRES_URL') or os.environ.get('PRISMA_DATABASE_URL')
    if not postgres_url:
        raise ValueError('DATABASE_URL environment variable is required')
    
    # Retry connection up to 3 times
    for attempt in range(3):
        try:
            conn = psycopg2.connect(
                postgres_url,
                cursor_factory=RealDictCursor,
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5
            )
            return DBConnection(conn)
        except psycopg2.OperationalError as e:
            if attempt == 2:
                raise
            time.sleep(0.5 * (attempt + 1))