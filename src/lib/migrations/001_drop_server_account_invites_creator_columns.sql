-- Migration 0001: Drop created_by and created_by_admin from server_account_invites

-- 1. Drop FK on created_by if it exists
SET @fk_created_by := (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by'
      AND REFERENCED_TABLE_NAME = 'server_accounts'
    LIMIT 1
);
SET @sql_drop_fk_created_by := IF(
    @fk_created_by IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY ', @fk_created_by)
);
PREPARE stmt_drop_fk_created_by FROM @sql_drop_fk_created_by;
EXECUTE stmt_drop_fk_created_by;
DEALLOCATE PREPARE stmt_drop_fk_created_by;

-- 2. Drop FK on created_by_admin if it exists
SET @fk_created_by_admin := (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by_admin'
      AND REFERENCED_TABLE_NAME = 'accounts'
    LIMIT 1
);
SET @sql_drop_fk_created_by_admin := IF(
    @fk_created_by_admin IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY ', @fk_created_by_admin)
);
PREPARE stmt_drop_fk_created_by_admin FROM @sql_drop_fk_created_by_admin;
EXECUTE stmt_drop_fk_created_by_admin;
DEALLOCATE PREPARE stmt_drop_fk_created_by_admin;

-- 3. Drop created_by column if it exists
SET @col_created_by := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by'
);
SET @sql_drop_col_created_by := IF(
    @col_created_by = 0,
    'SELECT 1',
    'ALTER TABLE server_account_invites DROP COLUMN created_by'
);
PREPARE stmt_drop_col_created_by FROM @sql_drop_col_created_by;
EXECUTE stmt_drop_col_created_by;
DEALLOCATE PREPARE stmt_drop_col_created_by;

-- 4. Drop created_by_admin column if it exists
SET @col_created_by_admin := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by_admin'
);
SET @sql_drop_col_created_by_admin := IF(
    @col_created_by_admin = 0,
    'SELECT 1',
    'ALTER TABLE server_account_invites DROP COLUMN created_by_admin'
);
PREPARE stmt_drop_col_created_by_admin FROM @sql_drop_col_created_by_admin;
EXECUTE stmt_drop_col_created_by_admin;
DEALLOCATE PREPARE stmt_drop_col_created_by_admin;
