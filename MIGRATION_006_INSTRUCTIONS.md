# Running Migration 006 on Vercel

## Issue
Tests are failing on Vercel because the `wo_type` constraint in the `ranking_matches` table doesn't include the value `'user'`.

## Solution
Run migration `006_update_wo_type_constraint.sql` on the Vercel database.

## Steps to Apply Migration

### Option 1: Using Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm i -g vercel

# Login to Vercel
vercel login

# Get database connection string
vercel env pull .env.local

# Run migration using psql
psql $DATABASE_URL -f src/database/migrations/006_update_wo_type_constraint.sql
```

### Option 2: Using Vercel Dashboard
1. Go to Vercel Dashboard → Your Project → Storage → Postgres
2. Click on "Query" tab
3. Run the following SQL:
```sql
ALTER TABLE ranking_matches DROP CONSTRAINT IF EXISTS ranking_matches_wo_type_check;
ALTER TABLE ranking_matches ADD CONSTRAINT ranking_matches_wo_type_check 
    CHECK (wo_type IN ('none', 'admin', 'forfeit', 'user'));
```

### Option 3: Using Python Script
```bash
# Set DATABASE_URL environment variable to Vercel Postgres URL
export DATABASE_URL="your-vercel-postgres-url"

# Run migration script
python run_migrations.py
```

## Verification
After running the migration, verify it worked:
```sql
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conname = 'ranking_matches_wo_type_check';
```

Expected output should show: `CHECK (wo_type IN ('none', 'admin', 'forfeit', 'user'))`

## Testing
After applying the migration, push a commit to trigger the CI/CD pipeline and verify tests pass.
