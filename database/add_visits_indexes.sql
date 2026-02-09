-- Performance optimization indexes for visits table
-- These indexes will dramatically improve query performance

-- Index on visit_date (most critical - used in date range queries)
CREATE INDEX IF NOT EXISTS idx_visits_visit_date ON visits(visit_date DESC);

-- Index on client_id (used in JOINs)
CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);

-- Composite index for common query patterns (date + client)
CREATE INDEX IF NOT EXISTS idx_visits_date_client ON visits(visit_date DESC, client_id);

-- Index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at DESC);

-- Index on created_by for worker filtering
CREATE INDEX IF NOT EXISTS idx_visits_created_by ON visits(created_by);

-- Indexes for visit_visit_reasons junction table
CREATE INDEX IF NOT EXISTS idx_visit_visit_reasons_visit_id ON visit_visit_reasons(visit_id);
CREATE INDEX IF NOT EXISTS idx_visit_visit_reasons_reason_id ON visit_visit_reasons(visit_reason_id);

-- Index on visit_reasons for category filtering
CREATE INDEX IF NOT EXISTS idx_visit_reasons_category ON visit_reasons(category);

-- Analyze tables to update statistics
ANALYZE visits;
ANALYZE visit_visit_reasons;
ANALYZE visit_reasons;
ANALYZE clients;

-- Show index information
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('visits', 'visit_visit_reasons', 'visit_reasons')
ORDER BY tablename, indexname;
