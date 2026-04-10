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

-- 5. Drop rewards_line from bot_discord_quests
SET @col_bdq_rewards_line := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_discord_quests' AND COLUMN_NAME = 'rewards_line'
);
SET @sql_bdq_drop_rewards_line := IF(
    @col_bdq_rewards_line = 0, 'SELECT 1',
    'ALTER TABLE bot_discord_quests DROP COLUMN rewards_line'
);
PREPARE stmt_bdq_drop_rewards_line FROM @sql_bdq_drop_rewards_line;
EXECUTE stmt_bdq_drop_rewards_line;
DEALLOCATE PREPARE stmt_bdq_drop_rewards_line;

-- 6. Rename orb_hint to reward in bot_discord_quests
SET @col_bdq_orb_hint := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bot_discord_quests' AND COLUMN_NAME = 'orb_hint'
);
SET @sql_bdq_rename_orb_hint := IF(
    @col_bdq_orb_hint = 0, 'SELECT 1',
    'ALTER TABLE bot_discord_quests CHANGE orb_hint reward TEXT NULL'
);
PREPARE stmt_bdq_rename_orb_hint FROM @sql_bdq_rename_orb_hint;
EXECUTE stmt_bdq_rename_orb_hint;
DEALLOCATE PREPARE stmt_bdq_rename_orb_hint;

-- 7. Rename orb_claimed to reward_claimed in server_member_discord_quests
SET @col_smdq_orb_claimed := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_discord_quests' AND COLUMN_NAME = 'orb_claimed'
);
SET @sql_smdq_rename := IF(
    @col_smdq_orb_claimed = 0, 'SELECT 1',
    'ALTER TABLE server_member_discord_quests CHANGE orb_claimed reward_claimed BOOLEAN NOT NULL DEFAULT FALSE'
);
PREPARE stmt_smdq_rename FROM @sql_smdq_rename;
EXECUTE stmt_smdq_rename;
DEALLOCATE PREPARE stmt_smdq_rename;

-- 8. Rename notified_at to created_at in bot_discord_quests if notified_at exists
SET @col_bdq_notified := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bot_discord_quests'
      AND COLUMN_NAME = 'notified_at'
);
SET @sql_rename_bdq := IF(
    @col_bdq_notified = 0,
    'SELECT 1',
    'ALTER TABLE bot_discord_quests CHANGE notified_at created_at DATETIME NOT NULL'
);
PREPARE stmt_rename_bdq FROM @sql_rename_bdq;
EXECUTE stmt_rename_bdq;
DEALLOCATE PREPARE stmt_rename_bdq;

-- 9. Rename notified_at to created_at in bot_roblox_items if notified_at exists
SET @col_bri_notified := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bot_roblox_items'
      AND COLUMN_NAME = 'notified_at'
);
SET @sql_rename_bri := IF(
    @col_bri_notified = 0,
    'SELECT 1',
    'ALTER TABLE bot_roblox_items CHANGE notified_at created_at DATETIME NOT NULL'
);
PREPARE stmt_rename_bri FROM @sql_rename_bri;
EXECUTE stmt_rename_bri;
DEALLOCATE PREPARE stmt_rename_bri;
