SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bot_roblox_items'
      AND COLUMN_NAME = 'thumbnail_url'
);

SET @sql_add_col := IF(
    @col_exists > 0,
    'SELECT 1',
    'ALTER TABLE bot_roblox_items ADD COLUMN thumbnail_url VARCHAR(512) NULL'
);

PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

