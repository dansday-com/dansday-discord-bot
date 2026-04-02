-- Migration 005: Make bots belong to accounts (waterfall: panel -> account -> bots)
-- Adds bots.account_id referencing accounts(id).
-- Backfills bots.account_id via accounts.panel_id using bots.panel_id where possible.
-- Then removes bots.panel_id (redundant; panel is implied via accounts.panel_id).
-- Safe to run multiple times.

-- 1) Add account_id column if missing
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'bots'
      AND column_name = 'account_id'
);
SET @s = IF(@col_exists = 0, 'ALTER TABLE bots ADD COLUMN account_id INT NULL AFTER secret_key', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Backfill account_id from panel_id (best-effort)
SET @panel_col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'bots'
      AND column_name = 'panel_id'
);
SET @accounts_panel_col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'accounts'
      AND column_name = 'panel_id'
);
SET @do_backfill = IF(@panel_col_exists > 0 AND @accounts_panel_col_exists > 0, 1, 0);
SET @s = IF(
    @do_backfill = 1,
    'UPDATE bots b
      LEFT JOIN (
        SELECT panel_id, MIN(id) AS account_id
        FROM accounts
        WHERE panel_id IS NOT NULL
        GROUP BY panel_id
      ) a ON a.panel_id = b.panel_id
      SET b.account_id = COALESCE(b.account_id, a.account_id)
      WHERE b.account_id IS NULL AND b.panel_id IS NOT NULL',
    'SELECT 1'
);
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Add foreign key bots.account_id -> accounts.id if missing
SET @fkname = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'account_id'
      AND REFERENCED_TABLE_NAME = 'accounts'
    LIMIT 1
);
SET @s = IF(@fkname IS NULL, 'ALTER TABLE bots ADD FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Add index for account_id (conditional)
SET @i = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'bots'
      AND index_name = 'idx_bots_account_id'
);
SET @s = IF(@i = 0, 'CREATE INDEX idx_bots_account_id ON bots(account_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Drop bots.panel_id foreign key, index, and column (if present)
SET @fk_panel = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'panel_id'
      AND REFERENCED_TABLE_NAME = 'panel'
    LIMIT 1
);
SET @s = IF(@fk_panel IS NOT NULL, CONCAT('ALTER TABLE bots DROP FOREIGN KEY `', @fk_panel, '`'), 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx_panel = (
    SELECT INDEX_NAME FROM information_schema.statistics
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'panel_id'
      AND INDEX_NAME != 'PRIMARY'
    LIMIT 1
);
SET @s = IF(@idx_panel IS NOT NULL, CONCAT('ALTER TABLE bots DROP INDEX `', @idx_panel, '`'), 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@panel_col_exists > 0, 'ALTER TABLE bots DROP COLUMN panel_id', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
