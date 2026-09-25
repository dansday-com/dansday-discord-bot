SET @t := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bots');
SET @stmt := IF(@t = 1, 'RENAME TABLE server_bots TO selfbots', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bot_status');
SET @stmt := IF(@t = 1, 'RENAME TABLE server_bot_status TO selfbot_status', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bot_servers');
SET @stmt := IF(@t = 1, 'RENAME TABLE server_bot_servers TO selfbot_servers', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bot_server_categories');
SET @stmt := IF(@t = 1, 'RENAME TABLE server_bot_server_categories TO selfbot_server_categories', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @t := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bot_server_channels');
SET @stmt := IF(@t = 1, 'RENAME TABLE server_bot_server_channels TO selfbot_server_channels', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_status' AND COLUMN_NAME = 'server_bot_id');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbot_status CHANGE COLUMN server_bot_id selfbot_id INT NOT NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_servers' AND COLUMN_NAME = 'server_bot_id');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbot_servers CHANGE COLUMN server_bot_id selfbot_id INT NOT NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_categories' AND COLUMN_NAME = 'server_bot_server_id');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbot_server_categories CHANGE COLUMN server_bot_server_id selfbot_server_id INT NOT NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND COLUMN_NAME = 'server_bot_server_id');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbot_server_channels CHANGE COLUMN server_bot_server_id selfbot_server_id INT NOT NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @f := (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbots' AND COLUMN_NAME = 'server_id' AND REFERENCED_TABLE_NAME = 'servers' LIMIT 1);
SET @stmt := IF(@f IS NOT NULL, CONCAT('ALTER TABLE selfbots DROP FOREIGN KEY ', @f), 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbots' AND INDEX_NAME = 'idx_server_bots_server_id');
SET @stmt := IF(@i > 0, 'DROP INDEX idx_server_bots_server_id ON selfbots', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbots' AND COLUMN_NAME = 'server_id');
SET @stmt := IF(@c = 1, 'ALTER TABLE selfbots DROP COLUMN server_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbots' AND INDEX_NAME = 'idx_server_bots_panel_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbots RENAME INDEX idx_server_bots_panel_id TO idx_selfbots_panel_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_status' AND INDEX_NAME = 'uq_server_bot_status_server_bot_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_status RENAME INDEX uq_server_bot_status_server_bot_id TO uq_selfbot_status_selfbot_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_servers' AND INDEX_NAME = 'uq_server_bot_server');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_servers RENAME INDEX uq_server_bot_server TO uq_selfbot_server', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_servers' AND INDEX_NAME = 'idx_server_bot_servers_bot_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_servers RENAME INDEX idx_server_bot_servers_bot_id TO idx_selfbot_servers_selfbot_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_servers' AND INDEX_NAME = 'idx_server_bot_servers_discord_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_servers RENAME INDEX idx_server_bot_servers_discord_id TO idx_selfbot_servers_discord_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_categories' AND INDEX_NAME = 'uq_server_bot_category');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_categories RENAME INDEX uq_server_bot_category TO uq_selfbot_server_category', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_categories' AND INDEX_NAME = 'idx_server_bot_server_categories_server_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_categories RENAME INDEX idx_server_bot_server_categories_server_id TO idx_selfbot_server_categories_selfbot_server_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_categories' AND INDEX_NAME = 'idx_server_bot_server_categories_discord_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_categories RENAME INDEX idx_server_bot_server_categories_discord_id TO idx_selfbot_server_categories_discord_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND INDEX_NAME = 'uq_server_bot_channel');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_channels RENAME INDEX uq_server_bot_channel TO uq_selfbot_server_channel', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND INDEX_NAME = 'idx_server_bot_server_channels_server_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_channels RENAME INDEX idx_server_bot_server_channels_server_id TO idx_selfbot_server_channels_selfbot_server_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND INDEX_NAME = 'idx_server_bot_server_channels_discord_id');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_channels RENAME INDEX idx_server_bot_server_channels_discord_id TO idx_selfbot_server_channels_discord_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbot_server_channels' AND INDEX_NAME = 'idx_server_bot_server_channels_parent_discord');
SET @stmt := IF(@i > 0, 'ALTER TABLE selfbot_server_channels RENAME INDEX idx_server_bot_server_channels_parent_discord TO idx_selfbot_server_channels_parent_discord', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
