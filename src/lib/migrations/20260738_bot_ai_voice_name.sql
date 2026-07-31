SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_name');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN voice_name VARCHAR(64) NULL AFTER voice_model', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
