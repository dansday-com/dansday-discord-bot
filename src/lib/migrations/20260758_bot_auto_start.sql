SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bots' AND COLUMN_NAME = 'auto_start');
SET @stmt := IF(@c = 0, 'ALTER TABLE bots ADD COLUMN auto_start BOOLEAN NOT NULL DEFAULT FALSE AFTER uptime_started_at', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'selfbots' AND COLUMN_NAME = 'auto_start');
SET @stmt := IF(@c = 0, 'ALTER TABLE selfbots ADD COLUMN auto_start BOOLEAN NOT NULL DEFAULT FALSE AFTER uptime_started_at', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

UPDATE bots SET auto_start = TRUE WHERE status IN ('running', 'starting');
UPDATE selfbots SET auto_start = TRUE WHERE status IN ('running', 'starting');
