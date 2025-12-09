-- Cleanup old statistics tables
-- Run this AFTER verifying match_statistics_unified works in production

-- Drop old match_statistics table
DROP TABLE IF EXISTS match_statistics CASCADE;

-- Verify cleanup
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE '%match%statistics%'
ORDER BY table_name;
