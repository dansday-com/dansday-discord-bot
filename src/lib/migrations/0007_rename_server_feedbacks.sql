-- Rename server_feedbacks -> server_member_feedbacks (idempotent)
-- Drop FK and index together in one ALTER TABLE, then rename

SET @fk := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_feedbacks'
      AND COLUMN_NAME = 'member_id'
      AND REFERENCED_TABLE_NAME = 'server_members'
    LIMIT 1
);
SET @idx := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_feedbacks'
      AND INDEX_NAME = 'idx_server_feedbacks_member'
);

-- Drop FK + index together in one statement when both exist
SET @sql := CASE
    WHEN @fk IS NOT NULL AND @idx > 0 THEN
        CONCAT('ALTER TABLE server_feedbacks DROP FOREIGN KEY `', @fk, '`, DROP INDEX idx_server_feedbacks_member')
    WHEN @fk IS NOT NULL THEN
        CONCAT('ALTER TABLE server_feedbacks DROP FOREIGN KEY `', @fk, '`')
    WHEN @idx > 0 THEN
        'ALTER TABLE server_feedbacks DROP INDEX idx_server_feedbacks_member'
    ELSE 'SELECT 1'
END;
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Rename table if it still exists as old name
SET @tbl := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_feedbacks');
SET @sql := IF(@tbl > 0, 'RENAME TABLE server_feedbacks TO server_member_feedbacks', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FK back on new table if missing
SET @fk_new := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_member_feedbacks'
      AND COLUMN_NAME = 'member_id'
      AND REFERENCED_TABLE_NAME = 'server_members'
);
SET @sql := IF(@fk_new = 0,
    'ALTER TABLE server_member_feedbacks ADD CONSTRAINT fk_smf_member FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add new index if missing
SET @idx_new := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_feedbacks' AND INDEX_NAME = 'idx_server_member_feedbacks_member');
SET @sql := IF(@idx_new = 0, 'CREATE INDEX idx_server_member_feedbacks_member ON server_member_feedbacks(member_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
