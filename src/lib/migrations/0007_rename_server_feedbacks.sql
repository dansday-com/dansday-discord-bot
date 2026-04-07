-- Rename server_feedbacks to server_member_feedbacks (idempotent)

-- Step 1: Drop the FK constraint on the OLD table (if old table still exists)
SET @fk_old := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_feedbacks'
      AND COLUMN_NAME = 'member_id'
      AND REFERENCED_TABLE_NAME = 'server_members'
    LIMIT 1
);
SET @sql := IF(@fk_old IS NOT NULL,
    CONCAT('ALTER TABLE server_feedbacks DROP FOREIGN KEY `', @fk_old, '`'),
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 2: Rename the table (only if old table still exists)
SET @tbl_old := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_feedbacks');
SET @sql := IF(@tbl_old > 0, 'RENAME TABLE server_feedbacks TO server_member_feedbacks', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 3: Drop old index if it still exists on the new table
SET @idx := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_feedbacks' AND INDEX_NAME = 'idx_server_feedbacks_member');
SET @sql := IF(@idx > 0, 'DROP INDEX idx_server_feedbacks_member ON server_member_feedbacks', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 4: Add FK back (if missing)
SET @fk_new := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_member_feedbacks'
      AND COLUMN_NAME = 'member_id'
      AND REFERENCED_TABLE_NAME = 'server_members'
);
SET @sql := IF(@fk_new = 0,
    'ALTER TABLE server_member_feedbacks ADD CONSTRAINT fk_server_member_feedbacks_member FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Step 5: Add new index (if missing)
SET @idx_new := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_feedbacks' AND INDEX_NAME = 'idx_server_member_feedbacks_member');
SET @sql := IF(@idx_new = 0, 'CREATE INDEX idx_server_member_feedbacks_member ON server_member_feedbacks(member_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
