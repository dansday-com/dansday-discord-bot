SET @fk := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_accounts'
	  AND COLUMN_NAME = 'invited_by'
	  AND REFERENCED_TABLE_NAME IS NOT NULL
	LIMIT 1
);
SET @sql := IF(
	@fk IS NOT NULL,
	CONCAT('ALTER TABLE server_accounts DROP FOREIGN KEY `', @fk, '`'),
	'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @hascol := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_accounts'
	  AND COLUMN_NAME = 'invited_by'
);
SET @sql2 := IF(
	@hascol > 0,
	'ALTER TABLE server_accounts DROP COLUMN invited_by',
	'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

SET @has_cba := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_account_invites'
	  AND COLUMN_NAME = 'created_by_admin'
);
SET @sql_cba := IF(
	@has_cba = 0,
	'ALTER TABLE server_account_invites ADD COLUMN created_by_admin INT NULL',
	'SELECT 1'
);
PREPARE stmt_cba FROM @sql_cba;
EXECUTE stmt_cba;
DEALLOCATE PREPARE stmt_cba;

SET @fk_accounts := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_account_invites'
	  AND COLUMN_NAME = 'created_by'
	  AND REFERENCED_TABLE_NAME = 'accounts'
	LIMIT 1
);
SET @had_accounts_fk := IF(@fk_accounts IS NOT NULL, 1, 0);

SET @sql_drop_acc := IF(
	@fk_accounts IS NOT NULL,
	CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY `', @fk_accounts, '`'),
	'SELECT 1'
);
PREPARE stmt_drop_acc FROM @sql_drop_acc;
EXECUTE stmt_drop_acc;
DEALLOCATE PREPARE stmt_drop_acc;

SET @sql_m1 := IF(
	@had_accounts_fk = 1,
	'UPDATE server_account_invites SET created_by_admin = created_by WHERE created_by IS NOT NULL',
	'SELECT 1'
);
PREPARE stmt_m1 FROM @sql_m1;
EXECUTE stmt_m1;
DEALLOCATE PREPARE stmt_m1;

SET @sql_m2 := IF(
	@had_accounts_fk = 1,
	'UPDATE server_account_invites SET created_by = NULL',
	'SELECT 1'
);
PREPARE stmt_m2 FROM @sql_m2;
EXECUTE stmt_m2;
DEALLOCATE PREPARE stmt_m2;

ALTER TABLE server_account_invites MODIFY created_by INT NULL;

SET @fk_sa := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_account_invites'
	  AND COLUMN_NAME = 'created_by'
	  AND REFERENCED_TABLE_NAME = 'server_accounts'
	LIMIT 1
);
SET @sql_sa := IF(
	@fk_sa IS NULL,
	'ALTER TABLE server_account_invites ADD CONSTRAINT server_account_invites_created_by_fk FOREIGN KEY (created_by) REFERENCES server_accounts(id) ON DELETE SET NULL',
	'SELECT 1'
);
PREPARE stmt_sa FROM @sql_sa;
EXECUTE stmt_sa;
DEALLOCATE PREPARE stmt_sa;

SET @fk_adm := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'server_account_invites'
	  AND COLUMN_NAME = 'created_by_admin'
	  AND REFERENCED_TABLE_NAME = 'accounts'
	LIMIT 1
);
SET @sql_adm := IF(
	@fk_adm IS NULL,
	'ALTER TABLE server_account_invites ADD CONSTRAINT server_account_invites_created_by_admin_fk FOREIGN KEY (created_by_admin) REFERENCES accounts(id) ON DELETE SET NULL',
	'SELECT 1'
);
PREPARE stmt_adm FROM @sql_adm;
EXECUTE stmt_adm;
DEALLOCATE PREPARE stmt_adm;
