-- Migration 0003: Add boost_level and total_boosters to server_bot_servers

SET @col_boost_level := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_bot_servers'
      AND COLUMN_NAME = 'boost_level'
);
SET @sql_add_boost_level := IF(
    @col_boost_level > 0,
    'SELECT 1',
    'ALTER TABLE server_bot_servers ADD COLUMN boost_level INT DEFAULT 0'
);
PREPARE stmt_add_boost_level FROM @sql_add_boost_level;
EXECUTE stmt_add_boost_level;
DEALLOCATE PREPARE stmt_add_boost_level;

SET @col_total_boosters := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_bot_servers'
      AND COLUMN_NAME = 'total_boosters'
);
SET @sql_add_total_boosters := IF(
    @col_total_boosters > 0,
    'SELECT 1',
    'ALTER TABLE server_bot_servers ADD COLUMN total_boosters INT DEFAULT 0'
);
PREPARE stmt_add_total_boosters FROM @sql_add_total_boosters;
EXECUTE stmt_add_total_boosters;
DEALLOCATE PREPARE stmt_add_total_boosters;
