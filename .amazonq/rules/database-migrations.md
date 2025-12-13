# Database Migration Rules

## Migration Process
- All database schema changes MUST be done through migration files in `src/database/migrations/`
- Migration files MUST be numbered sequentially: `001_description.sql`, `002_description.sql`, etc.
- Migration files MUST be idempotent (use `IF NOT EXISTS`, `IF EXISTS`, etc.)

## Documentation Requirements
When creating a database migration, you MUST update:

1. **Schema File**: `src/database/postgres_schema.sql`
   - Add the changes to the main schema file
   - Keep it synchronized with all migrations

2. **Architecture Documentation**: `.amazonq/rules/architecture.md`
   - Update the "Database Architecture" section if tables/columns change
   - Update the "Indexes" section if indexes are added/removed
   - Update any relevant sections affected by the change

## Migration Checklist
- [ ] Create migration file in `src/database/migrations/`
- [ ] Update `src/database/postgres_schema.sql`
- [ ] Update `.amazonq/rules/architecture.md` (Database Architecture section)
- [ ] Test migration on local database
- [ ] Verify schema matches production after migration
