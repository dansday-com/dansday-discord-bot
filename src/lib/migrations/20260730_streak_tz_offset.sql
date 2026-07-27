SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_streaks' AND COLUMN_NAME = 'tz_offset_min');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_streaks ADD COLUMN tz_offset_min INT NOT NULL DEFAULT 0 AFTER total_claims', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
