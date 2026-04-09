-- Migration 0002: Move bots ownership from account_id to panel_id (account -> panel -> bots)

-- 1. Add panel_id column if it doesn't exist
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'panel_id'
);
SET @sql_add_col := IF(
    @col_exists > 0,
    'SELECT 1',
    'ALTER TABLE bots ADD COLUMN panel_id INT NULL AFTER secret_key'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

-- 2. Populate panel_id from account -> panel_id where account_id still exists
SET @account_id_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'account_id'
);
SET @sql_populate := IF(
    @account_id_exists > 0,
    'UPDATE bots b INNER JOIN accounts a ON a.id = b.account_id SET b.panel_id = a.panel_id WHERE b.panel_id IS NULL',
    'SELECT 1'
);
PREPARE stmt_populate FROM @sql_populate;
EXECUTE stmt_populate;
DEALLOCATE PREPARE stmt_populate;

-- 3. Add FK on panel_id if not already present
SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'panel_id'
      AND REFERENCED_TABLE_NAME = 'panels'
);
SET @sql_add_fk := IF(
    @fk_exists > 0,
    'SELECT 1',
    'ALTER TABLE bots MODIFY COLUMN panel_id INT NOT NULL, ADD CONSTRAINT fk_bots_panel_id FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE'
);
PREPARE stmt_add_fk FROM @sql_add_fk;
EXECUTE stmt_add_fk;
DEALLOCATE PREPARE stmt_add_fk;

-- 4. Add index on panel_id if not already present
SET @idx_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND INDEX_NAME = 'idx_bots_panel_id'
);
SET @sql_add_idx := IF(
    @idx_exists > 0,
    'SELECT 1',
    'CREATE INDEX idx_bots_panel_id ON bots(panel_id)'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

-- 5. Drop FK on account_id if it exists
SET @fk_account := (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'account_id'
      AND REFERENCED_TABLE_NAME = 'accounts'
    LIMIT 1
);
SET @sql_drop_fk_account := IF(
    @fk_account IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE bots DROP FOREIGN KEY ', @fk_account)
);
PREPARE stmt_drop_fk_account FROM @sql_drop_fk_account;
EXECUTE stmt_drop_fk_account;
DEALLOCATE PREPARE stmt_drop_fk_account;

-- 6. Drop account_id column if it exists
SET @sql_drop_col := IF(
    @account_id_exists > 0,
    'ALTER TABLE bots DROP COLUMN account_id',
    'SELECT 1'
);
PREPARE stmt_drop_col FROM @sql_drop_col;
EXECUTE stmt_drop_col;
DEALLOCATE PREPARE stmt_drop_col;
