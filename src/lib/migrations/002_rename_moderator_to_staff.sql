-- Migration 0002: Rename 'moderator' to 'staff' in server_accounts and server_account_invites

-- server_accounts
SET @has_moderator_sa = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_accounts'
      AND COLUMN_NAME = 'account_type'
      AND COLUMN_TYPE LIKE '%moderator%'
);
SET @sql_sa_expand = IF(@has_moderator_sa > 0,
    "ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner','moderator','staff') NOT NULL",
    'SELECT 1');
PREPARE stmt_sa_expand FROM @sql_sa_expand;
EXECUTE stmt_sa_expand;
DEALLOCATE PREPARE stmt_sa_expand;

UPDATE server_accounts SET account_type = 'staff' WHERE account_type = 'moderator';

SET @sql_sa_shrink = IF(@has_moderator_sa > 0,
    "ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner','staff') NOT NULL",
    'SELECT 1');
PREPARE stmt_sa_shrink FROM @sql_sa_shrink;
EXECUTE stmt_sa_shrink;
DEALLOCATE PREPARE stmt_sa_shrink;

-- server_account_invites
SET @has_moderator_sai = (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'account_type'
      AND COLUMN_TYPE LIKE '%moderator%'
);
SET @sql_sai_expand = IF(@has_moderator_sai > 0,
    "ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner','moderator','staff') NOT NULL",
    'SELECT 1');
PREPARE stmt_sai_expand FROM @sql_sai_expand;
EXECUTE stmt_sai_expand;
DEALLOCATE PREPARE stmt_sai_expand;

UPDATE server_account_invites SET account_type = 'staff' WHERE account_type = 'moderator';

SET @sql_sai_shrink = IF(@has_moderator_sai > 0,
    "ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner','staff') NOT NULL",
    'SELECT 1');
PREPARE stmt_sai_shrink FROM @sql_sai_shrink;
EXECUTE stmt_sai_shrink;
DEALLOCATE PREPARE stmt_sai_shrink;
