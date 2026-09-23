SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_thinking');
SET @stmt := IF(@c = 0, "ALTER TABLE bot_ai ADD COLUMN voice_thinking ENUM('low','medium','high') NOT NULL DEFAULT 'low' AFTER voice_name", 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
