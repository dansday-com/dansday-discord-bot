-- Enforce: bots belong to accounts; accounts belong to panels.

-- Ensure default panel exists
INSERT INTO panels (slug, created_at, updated_at)
SELECT 'default', UTC_TIMESTAMP(), UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM panels WHERE slug = 'default');

-- Backfill accounts.panel_id -> default where NULL
UPDATE accounts a
JOIN panels p ON p.slug = 'default'
SET a.panel_id = p.id
WHERE a.panel_id IS NULL;

-- Make accounts.panel_id NOT NULL and adjust FK (no SET NULL)
SET @fk_accounts_panel := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'accounts'
	  AND COLUMN_NAME = 'panel_id'
	  AND REFERENCED_TABLE_NAME = 'panels'
	LIMIT 1
);
SET @sql_drop_fk_accounts_panel := IF(
	@fk_accounts_panel IS NULL,
	'SELECT 1',
	CONCAT('ALTER TABLE accounts DROP FOREIGN KEY ', @fk_accounts_panel)
);
PREPARE stmt_drop_fk_accounts_panel FROM @sql_drop_fk_accounts_panel;
EXECUTE stmt_drop_fk_accounts_panel;
DEALLOCATE PREPARE stmt_drop_fk_accounts_panel;

ALTER TABLE accounts
	MODIFY COLUMN panel_id INT NOT NULL;

SET @fk_accounts_panel_after := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'accounts'
	  AND COLUMN_NAME = 'panel_id'
	  AND REFERENCED_TABLE_NAME = 'panels'
	LIMIT 1
);
SET @sql_add_fk_accounts_panel := IF(
	@fk_accounts_panel_after IS NULL,
	'ALTER TABLE accounts ADD CONSTRAINT fk_accounts_panel_id FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE RESTRICT',
	'SELECT 1'
);
PREPARE stmt_add_fk_accounts_panel FROM @sql_add_fk_accounts_panel;
EXECUTE stmt_add_fk_accounts_panel;
DEALLOCATE PREPARE stmt_add_fk_accounts_panel;

-- Backfill bots.account_id where NULL -> oldest superadmin (lowest id)
UPDATE bots
SET account_id = (SELECT MIN(id) FROM accounts)
WHERE account_id IS NULL;

-- Replace bots.account_id FK to CASCADE and enforce NOT NULL
SET @fk_bots_account := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'bots'
	  AND COLUMN_NAME = 'account_id'
	  AND REFERENCED_TABLE_NAME = 'accounts'
	LIMIT 1
);
SET @sql_drop_fk_bots_account := IF(
	@fk_bots_account IS NULL,
	'SELECT 1',
	CONCAT('ALTER TABLE bots DROP FOREIGN KEY ', @fk_bots_account)
);
PREPARE stmt_drop_fk_bots_account FROM @sql_drop_fk_bots_account;
EXECUTE stmt_drop_fk_bots_account;
DEALLOCATE PREPARE stmt_drop_fk_bots_account;

ALTER TABLE bots
	MODIFY COLUMN account_id INT NOT NULL;

SET @fk_bots_account_after := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'bots'
	  AND COLUMN_NAME = 'account_id'
	  AND REFERENCED_TABLE_NAME = 'accounts'
	LIMIT 1
);
SET @sql_add_fk_bots_account := IF(
	@fk_bots_account_after IS NULL,
	'ALTER TABLE bots ADD CONSTRAINT fk_bots_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE',
	'SELECT 1'
);
PREPARE stmt_add_fk_bots_account FROM @sql_add_fk_bots_account;
EXECUTE stmt_add_fk_bots_account;
DEALLOCATE PREPARE stmt_add_fk_bots_account;

