#!/usr/bin/env python3
"""
Database Migration Runner
Runs all SQL migration files in src/database/migrations/
"""
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent))

from src.database import get_db

def run_migrations():
    """Run all migration files in order"""
    migrations_dir = Path(__file__).parent / 'src' / 'database' / 'migrations'
    
    # Get all .sql files and sort them
    migration_files = sorted([f for f in migrations_dir.glob('*.sql') if f.name != 'README.md'])
    
    if not migration_files:
        print("No migration files found")
        return
    
    db = get_db()
    
    for migration_file in migration_files:
        print(f"Running migration: {migration_file.name}")
        
        try:
            with open(migration_file, 'r') as f:
                sql = f.read()
            
            # Execute the migration
            db.execute(sql)
            db.commit()
            print(f"✓ {migration_file.name} completed successfully")
            
        except Exception as e:
            print(f"✗ Error in {migration_file.name}: {str(e)}")
            db.rollback()
            # Continue with other migrations
    
    db.close()
    print("\nMigrations completed!")

if __name__ == '__main__':
    run_migrations()
