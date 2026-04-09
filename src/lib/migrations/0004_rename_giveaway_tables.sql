-- Migration 0004: Rename server_giveaways -> server_member_giveaways and server_giveaway_entries -> server_member_giveaway_entries

-- 1. Rename server_giveaway_entries first (it has FK to server_giveaways)
SET @entries_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_giveaway_entries'
);
SET @sql_rename_entries := IF(
    @entries_exists > 0,
    'RENAME TABLE server_giveaway_entries TO server_member_giveaway_entries',
    'SELECT 1'
);
PREPARE stmt FROM @sql_rename_entries;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Rename server_giveaways
SET @giveaways_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_giveaways'
);
SET @sql_rename_giveaways := IF(
    @giveaways_exists > 0,
    'RENAME TABLE server_giveaways TO server_member_giveaways',
    'SELECT 1'
);
PREPARE stmt FROM @sql_rename_giveaways;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
