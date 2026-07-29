SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_friends' AND COLUMN_NAME = 'minutes');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_level_friends ADD COLUMN minutes INT NOT NULL DEFAULT 0 AFTER ticks', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

UPDATE server_member_level_friends SET minutes = ticks WHERE minutes = 0 AND ticks > 0;

SET @old := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_friends' AND COLUMN_NAME = 'xp_together');
SET @new := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_friends' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@old = 1 AND @new = 0, 'ALTER TABLE server_member_level_friends CHANGE COLUMN xp_together xp BIGINT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
