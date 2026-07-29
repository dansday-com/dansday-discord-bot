SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_discord_quests' AND COLUMN_NAME = 'thumbnail_url');
SET @stmt := IF(@col = 0, 'ALTER TABLE bot_discord_quests ADD COLUMN thumbnail_url VARCHAR(512) NULL AFTER task_detail_line', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_discord_quests' AND COLUMN_NAME = 'banner_url');
SET @stmt := IF(@col = 0, 'ALTER TABLE bot_discord_quests ADD COLUMN banner_url VARCHAR(512) NULL AFTER thumbnail_url', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
