SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_discord_quests' AND COLUMN_NAME = 'task_detail_line');
SET @stmt := IF(@col = 1, 'UPDATE bot_discord_quests SET quest_description = task_detail_line WHERE task_detail_line IS NOT NULL AND task_detail_line <> ''''', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @stmt := IF(@col = 1, 'ALTER TABLE bot_discord_quests DROP COLUMN task_detail_line', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
