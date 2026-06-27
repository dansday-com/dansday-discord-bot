SET @has_items := (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items');

SET @has_bot_id := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'bot_id');
SET @has_panel_id := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'panel_id');
SET @ddl := IF(@has_items > 0 AND @has_bot_id > 0 AND @has_panel_id = 0,
    'ALTER TABLE items CHANGE COLUMN bot_id panel_id INT NOT NULL',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_cfg := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'config');
SET @ddl := IF(@has_items > 0 AND @has_cfg = 0,
    'ALTER TABLE items ADD COLUMN config JSON NOT NULL DEFAULT (''{}'') AFTER cost',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_enabled := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'enabled');
SET @ddl := IF(@has_items > 0 AND @has_enabled = 0,
    'ALTER TABLE items ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_usable := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'usable');
SET @ddl := IF(@has_items > 0 AND @has_usable = 0,
    'ALTER TABLE items ADD COLUMN usable BOOLEAN NOT NULL DEFAULT TRUE AFTER enabled',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_from := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'available_from');
SET @ddl := IF(@has_items > 0 AND @has_from = 0,
    'ALTER TABLE items ADD COLUMN available_from DATETIME NULL',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_to := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'available_to');
SET @ddl := IF(@has_items > 0 AND @has_to = 0,
    'ALTER TABLE items ADD COLUMN available_to DATETIME NULL',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_recur := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'recurring_schedule');
SET @ddl := IF(@has_items > 0 AND @has_recur = 0,
    'ALTER TABLE items ADD COLUMN recurring_schedule JSON NULL',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

SET @has_sort := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'sort_order');
SET @ddl := IF(@has_items > 0 AND @has_sort = 0,
    'ALTER TABLE items ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
    'SELECT 1');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
