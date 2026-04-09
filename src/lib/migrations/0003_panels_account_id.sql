-- Migration 0003: Move ownership from accounts.panel_id to panels.account_id (accounts -> panels)

-- 1. Add account_id column to panels if not exists
SET @col_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'panels'
      AND COLUMN_NAME = 'account_id'
);
SET @sql_add_col := IF(
    @col_exists > 0,
    'SELECT 1',
    'ALTER TABLE panels ADD COLUMN account_id INT NULL'
);
PREPARE stmt FROM @sql_add_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Backfill account_id on panels from accounts.panel_id (1 account per panel)
SET @panel_id_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'accounts'
      AND COLUMN_NAME = 'panel_id'
);
SET @sql_backfill := IF(
    @panel_id_exists > 0,
    'UPDATE panels p INNER JOIN accounts a ON a.panel_id = p.id SET p.account_id = a.id WHERE p.account_id IS NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql_backfill;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Add FK panels.account_id -> accounts.id if not exists
SET @fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'panels'
      AND COLUMN_NAME = 'account_id'
      AND REFERENCED_TABLE_NAME = 'accounts'
);
SET @sql_add_fk := IF(
    @fk_exists > 0,
    'SELECT 1',
    'ALTER TABLE panels MODIFY COLUMN account_id INT NOT NULL, ADD CONSTRAINT fk_panels_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE'
);
PREPARE stmt FROM @sql_add_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 4. Add unique index on panels.account_id (1 account per panel)
SET @idx_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'panels'
      AND INDEX_NAME = 'uq_panels_account_id'
);
SET @sql_add_idx := IF(
    @idx_exists > 0,
    'SELECT 1',
    'ALTER TABLE panels ADD UNIQUE KEY uq_panels_account_id (account_id)'
);
PREPARE stmt FROM @sql_add_idx;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Drop FK on accounts.panel_id if exists
SET @fk_name := (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'accounts'
      AND COLUMN_NAME = 'panel_id'
      AND REFERENCED_TABLE_NAME = 'panels'
    LIMIT 1
);
SET @sql_drop_fk := IF(
    @fk_name IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE accounts DROP FOREIGN KEY ', @fk_name)
);
PREPARE stmt FROM @sql_drop_fk;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Drop accounts.panel_id column if exists
SET @sql_drop_col := IF(
    @panel_id_exists > 0,
    'ALTER TABLE accounts DROP COLUMN panel_id',
    'SELECT 1'
);
PREPARE stmt FROM @sql_drop_col;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Drop slug column from panels if exists
SET @slug_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'panels'
      AND COLUMN_NAME = 'slug'
);
SET @sql_drop_slug := IF(
    @slug_exists > 0,
    'ALTER TABLE panels DROP COLUMN slug',
    'SELECT 1'
);
PREPARE stmt FROM @sql_drop_slug;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
