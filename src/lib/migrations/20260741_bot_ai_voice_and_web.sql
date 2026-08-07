SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_api_key');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN voice_api_key TEXT NULL AFTER voice_name', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'voice_system_prompt');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN voice_system_prompt TEXT NULL AFTER voice_api_key', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'search_api_url');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN search_api_url TEXT NULL AFTER voice_system_prompt', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'search_api_key');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN search_api_key TEXT NULL AFTER search_api_url', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'search_model');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN search_model VARCHAR(191) NULL AFTER search_api_key', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'fetch_api_url');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN fetch_api_url TEXT NULL AFTER search_model', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'fetch_api_key');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN fetch_api_key TEXT NULL AFTER fetch_api_url', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'fetch_model');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN fetch_model VARCHAR(191) NULL AFTER fetch_api_key', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'image_api_url');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN image_api_url TEXT NULL AFTER fetch_model', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'image_api_key');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN image_api_key TEXT NULL AFTER image_api_url', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_ai' AND COLUMN_NAME = 'image_model');
SET @stmt := IF(@c = 0, 'ALTER TABLE bot_ai ADD COLUMN image_model VARCHAR(191) NULL AFTER image_api_key', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
