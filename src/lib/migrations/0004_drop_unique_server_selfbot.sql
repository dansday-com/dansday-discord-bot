SET @has_unique := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_bots'
      AND INDEX_NAME = 'unique_server_selfbot'
);
SET @sql := IF(
    @has_unique = 0,
    'SELECT 1',
    'ALTER TABLE server_bots DROP INDEX unique_server_selfbot'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
