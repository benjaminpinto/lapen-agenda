# Statistics Migration - Execution Checklist

## Pre-Migration (30 minutes)

### Preparation
- [ ] Read `docs/STATISTICS_MIGRATION_GUIDE.md` completely
- [ ] Read `docs/STATISTICS_MIGRATION_SUMMARY.md` for quick reference
- [ ] Review `docs/STATISTICS_BEFORE_AFTER.md` to understand changes
- [ ] Backup database: `pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql`
- [ ] Verify backup: `ls -lh backup_*.sql`
- [ ] Test database connection: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_statistics;"`
- [ ] Note current row counts for verification

### Current System Metrics
```bash
# Record these numbers
psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_statistics;"
# Result: _____ rows

psql $DATABASE_URL -c "SELECT COUNT(*) FROM ranking_matches WHERE status = 'completed';"
# Result: _____ rows

# Expected match_results rows = sum of above
```

---

## Phase 1: Create Schema (10 minutes)

### Step 1: Create New Table
- [ ] Review SQL: `cat src/database/migrations/create_match_results_unified.sql`
- [ ] Run migration: `psql $DATABASE_URL -f src/database/migrations/create_match_results_unified.sql`
- [ ] Verify table created: `psql $DATABASE_URL -c "\d match_results"`
- [ ] Verify indexes: `psql $DATABASE_URL -c "\di match_results*"`

### Step 2: Create Utility
- [ ] Verify file exists: `cat src/utils/score_parser.py`
- [ ] Test parser:
```python
python3 -c "
from src.utils.score_parser import parse_score
print(parse_score('6-4, 3-6, 10-8'))
# Should output: {'p1_sets': 2, 'p2_sets': 1, 'p1_games': 19, 'p2_games': 18}
"
```

---

## Phase 2: Migrate Data (15 minutes)

### Step 1: Review Migration SQL
- [ ] Review: `cat src/database/migrations/migrate_to_match_results.sql`
- [ ] Understand what data will be migrated

### Step 2: Run Migration
- [ ] Execute: `psql $DATABASE_URL -f src/database/migrations/migrate_to_match_results.sql`
- [ ] Review output counts
- [ ] Verify counts match:
```bash
# Should see:
# match_statistics: X rows
# ranking_matches (completed): Y rows
# match_results (total): X + Y rows
```

### Step 3: Spot Check Data
- [ ] Check sample records:
```sql
psql $DATABASE_URL -c "
SELECT player1_name, player2_name, winner_name, score, match_type 
FROM match_results 
ORDER BY created_at DESC 
LIMIT 5;
"
```
- [ ] Verify player names are correct
- [ ] Verify scores are present
- [ ] Verify match types are correct

---

## Phase 3: Deploy V2 API (30 minutes)

### Step 1: Create V2 Routes
- [ ] Create file: `src/routes/statistics_v2.py`
- [ ] Copy code from migration guide (Phase 3, Step 3.2)
- [ ] Review code for any project-specific adjustments

### Step 2: Register Blueprint
- [ ] Edit `main.py`
- [ ] Add import: `from src.routes.statistics_v2 import statistics_v2_bp`
- [ ] Add registration: `app.register_blueprint(statistics_v2_bp)`
- [ ] Save file

### Step 3: Test Locally
- [ ] Start server: `python main.py`
- [ ] Test V2 endpoint:
```bash
curl "http://localhost:5001/api/v2/statistics/players"
# Should return list of players

curl "http://localhost:5001/api/v2/statistics/player?player1=PLAYER_NAME"
# Should return player stats
```
- [ ] Compare with old endpoint:
```bash
curl "http://localhost:5001/api/statistics/player?player1=PLAYER_NAME"
# Should return same data
```

### Step 4: Deploy
- [ ] Commit changes:
```bash
git add .
git commit -m "feat: add unified statistics API v2"
git push
```
- [ ] Wait for deployment
- [ ] Verify V2 works in production

---

## Phase 4: Testing Period (1-2 weeks)

### Daily Checks
- [ ] Day 1: Monitor logs for errors
- [ ] Day 2: Check response times
- [ ] Day 3: Verify data consistency
- [ ] Day 4: Test edge cases
- [ ] Day 5: Review user feedback
- [ ] Day 6-7: Continue monitoring
- [ ] Week 2: Final validation

### Monitoring Commands
```bash
# Check for errors
tail -f logs/app.log | grep -i "statistics"

# Check response times
curl -w "@curl-format.txt" "http://localhost:5001/api/v2/statistics/player?player1=X"

# Compare old vs new
python tests/test_statistics_migration.py
```

### Success Criteria
- [ ] No errors in logs
- [ ] Response time < 200ms
- [ ] Data matches between v1 and v2
- [ ] All endpoints working
- [ ] No user complaints

---

## Phase 5: Switch Frontend (15 minutes)

### Step 1: Update API Calls
- [ ] Edit `src/components/statistics/Statistics.jsx`
- [ ] Find all `/api/statistics/` calls
- [ ] Replace with `/api/v2/statistics/`
- [ ] Changes needed at approximately:
  - Line 70: `fetchPlayers()`
  - Line 90: `fetchGeneralStats()`
  - Line 100: `fetchOpponents()`
  - Line 120: `fetchStatistics()`

### Step 2: Test Locally
- [ ] Start frontend: `npm run dev`
- [ ] Navigate to `/statistics`
- [ ] Test all filters
- [ ] Test player selection
- [ ] Test head-to-head
- [ ] Test general stats
- [ ] Verify no console errors

### Step 3: Deploy
- [ ] Commit changes:
```bash
git add src/components/statistics/Statistics.jsx
git commit -m "feat: switch statistics to v2 API"
git push
```
- [ ] Wait for deployment
- [ ] Test in production

---

## Phase 6: Monitoring (1 week)

### Daily Checks
- [ ] Day 1: Monitor production logs
- [ ] Day 2: Check error rates
- [ ] Day 3: Verify performance
- [ ] Day 4: Review user feedback
- [ ] Day 5: Check data consistency
- [ ] Day 6-7: Final validation

### Metrics to Track
- [ ] API response time: _____ ms (target: <200ms)
- [ ] Error rate: _____ % (target: 0%)
- [ ] User complaints: _____ (target: 0)
- [ ] Data discrepancies: _____ (target: 0)

---

## Phase 7: Cleanup (1 hour)

### Step 1: Rename V2 to Main
- [ ] Backup current routes: `cp src/routes/statistics.py src/routes/statistics_old_backup.py`
- [ ] Rename V2: `mv src/routes/statistics_v2.py src/routes/statistics.py`
- [ ] Edit `src/routes/statistics.py`:
  - Change `statistics_v2_bp` to `statistics_bp`
  - Change `/api/v2/statistics` to `/api/statistics`
- [ ] Update `main.py`:
  - Remove old import
  - Update to use new statistics_bp

### Step 2: Update Frontend URLs
- [ ] Edit `src/components/statistics/Statistics.jsx`
- [ ] Change `/api/v2/statistics/` back to `/api/statistics/`
- [ ] Test locally
- [ ] Deploy

### Step 3: Drop Old Tables
- [ ] Create backup table:
```sql
psql $DATABASE_URL -c "CREATE TABLE match_statistics_backup AS SELECT * FROM match_statistics;"
```
- [ ] Verify backup: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM match_statistics_backup;"`
- [ ] Drop old table:
```sql
psql $DATABASE_URL -c "DROP TABLE IF EXISTS match_statistics CASCADE;"
```
- [ ] Clean ranking_matches:
```sql
psql $DATABASE_URL -c "
ALTER TABLE ranking_matches 
    DROP COLUMN IF EXISTS sets_p1,
    DROP COLUMN IF EXISTS sets_p2,
    DROP COLUMN IF EXISTS games_p1,
    DROP COLUMN IF EXISTS games_p2,
    DROP COLUMN IF EXISTS points_p1,
    DROP COLUMN IF EXISTS points_p2;
"
```

### Step 4: Verify Cleanup
- [ ] Check tables: `psql $DATABASE_URL -c "\dt"`
- [ ] Verify match_statistics is gone
- [ ] Verify match_results exists
- [ ] Verify ranking_matches columns removed
- [ ] Test all statistics endpoints
- [ ] Verify frontend works

---

## Rollback Procedures

### If Issues in Phase 3-4 (V2 Testing)
```bash
# 1. Disable V2 in main.py
# Comment out: app.register_blueprint(statistics_v2_bp)

# 2. Restart server
python main.py

# 3. Old API still works, no data loss
```

### If Issues in Phase 5 (Frontend Switch)
```bash
# 1. Revert frontend commit
git revert HEAD

# 2. Push revert
git push

# 3. Old API still works
```

### If Issues in Phase 7 (Cleanup)
```bash
# 1. Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD.sql

# 2. Revert code changes
git revert HEAD~3..HEAD

# 3. Push reverts
git push
```

---

## Post-Migration Validation

### Data Integrity
- [ ] Row counts match original
- [ ] No duplicate records
- [ ] All player names correct
- [ ] All scores present
- [ ] All dates valid

### Performance
- [ ] Response time < 200ms ✅
- [ ] No slow queries
- [ ] Indexes being used
- [ ] No N+1 queries

### Functionality
- [ ] Player statistics work
- [ ] General statistics work
- [ ] Head-to-head works
- [ ] Filters work
- [ ] Add result works

### Code Quality
- [ ] No dead code
- [ ] No unused imports
- [ ] Tests pass
- [ ] Linter happy

---

## Success Metrics

### Before Migration
- Tables: 2 (match_statistics + ranking_matches)
- Code lines: ~300
- Response time: ~300ms
- Queries per request: 2

### After Migration
- Tables: 1 (match_results)
- Code lines: ~150 ✅ (50% reduction)
- Response time: ~150ms ✅ (2x faster)
- Queries per request: 1 ✅ (50% reduction)

---

## Documentation Updates

- [ ] Update `docs/STATISTICS_MODULE.md` with new schema
- [ ] Update `swagger.yaml` with V2 endpoints
- [ ] Update `README.md` if needed
- [ ] Add migration notes to changelog
- [ ] Update architecture diagrams

---

## Final Sign-Off

- [ ] All phases completed
- [ ] All tests passing
- [ ] No errors in production
- [ ] Performance improved
- [ ] Code simplified
- [ ] Documentation updated
- [ ] Team notified
- [ ] Celebration! 🎉

---

## Timeline Tracking

| Phase | Planned | Actual | Status |
|-------|---------|--------|--------|
| Pre-migration | 30 min | _____ | ⬜ |
| Phase 1: Schema | 10 min | _____ | ⬜ |
| Phase 2: Data | 15 min | _____ | ⬜ |
| Phase 3: V2 API | 30 min | _____ | ⬜ |
| Phase 4: Testing | 1-2 weeks | _____ | ⬜ |
| Phase 5: Frontend | 15 min | _____ | ⬜ |
| Phase 6: Monitor | 1 week | _____ | ⬜ |
| Phase 7: Cleanup | 1 hour | _____ | ⬜ |

**Total active work:** ~2 hours
**Total calendar time:** 2-3 weeks

---

## Notes & Issues

Use this space to track any issues or observations during migration:

```
Date: ___________
Issue: 
Resolution:

Date: ___________
Issue:
Resolution:

Date: ___________
Issue:
Resolution:
```

---

## Contact & Support

- Full guide: `docs/STATISTICS_MIGRATION_GUIDE.md`
- Quick reference: `docs/STATISTICS_MIGRATION_SUMMARY.md`
- Visual comparison: `docs/STATISTICS_BEFORE_AFTER.md`
- Rollback plan: See "Rollback Procedures" above

**Remember:** You can rollback at any point before Phase 7 with zero data loss! 🛡️
