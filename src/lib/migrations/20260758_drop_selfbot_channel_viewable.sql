SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND INDEX_NAME = 'idx_selfbot_server_channels_viewable');
SET @stmt := IF(@i > 0, 'DROP INDEX idx_selfbot_server_channels_viewable ON selfbot_server_channels', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND COLUMN_NAME = 'viewable');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbot_server_channels DROP COLUMN viewable', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
