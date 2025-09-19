import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

conn = psycopg2.connect(os.environ['PRISMA_DATABASE_URL'])
cur = conn.cursor()

with open('src/database/postgres_schema.sql', 'r') as f:
    cur.execute(f.read())

conn.commit()
cur.close()
conn.close()
print("Database schema created successfully!")