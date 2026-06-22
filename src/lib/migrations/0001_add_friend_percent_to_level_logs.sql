SET @col_exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_member_level_logs'
      AND COLUMN_NAME = 'friend_percent'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE server_member_level_logs ADD COLUMN friend_percent INT NULL AFTER skim_percent',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
