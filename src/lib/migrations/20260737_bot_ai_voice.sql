SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_enabled');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN voice_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER reasoning', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_model');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN voice_model VARCHAR(191) NULL AFTER voice_enabled', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
