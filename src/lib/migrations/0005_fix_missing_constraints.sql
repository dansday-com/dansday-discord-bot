-- Add missing FK: accounts.panel_id -> panels(id)
SET @fk := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts'
      AND COLUMN_NAME = 'panel_id' AND REFERENCED_TABLE_NAME = 'panels' LIMIT 1
);
SET @sql := IF(@fk IS NULL,
    'ALTER TABLE accounts ADD CONSTRAINT fk_accounts_panel_id FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing index: accounts.email
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_accounts_email');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_accounts_email ON accounts(email)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing index: accounts.username
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_accounts_username');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_accounts_username ON accounts(username)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing index: accounts.panel_id
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_accounts_panel_id');
SET @sql := IF(@has = 0, 'CREATE INDEX idx_accounts_panel_id ON accounts(panel_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing UNIQUE KEY: panels.slug
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'panels' AND INDEX_NAME = 'uq_panels_slug');
SET @sql := IF(@has = 0, 'ALTER TABLE panels ADD UNIQUE KEY uq_panels_slug (slug)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing FK: server_account_invites.created_by -> server_accounts(id)
SET @fk := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by' AND REFERENCED_TABLE_NAME = 'server_accounts' LIMIT 1
);
SET @sql := IF(@fk IS NULL,
    'ALTER TABLE server_account_invites ADD CONSTRAINT fk_sai_created_by FOREIGN KEY (created_by) REFERENCES server_accounts(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing FK: server_account_invites.created_by_admin -> accounts(id)
SET @fk := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'created_by_admin' AND REFERENCED_TABLE_NAME = 'accounts' LIMIT 1
);
SET @sql := IF(@fk IS NULL,
    'ALTER TABLE server_account_invites ADD CONSTRAINT fk_sai_created_by_admin FOREIGN KEY (created_by_admin) REFERENCES accounts(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add missing FK: server_account_invites.used_by -> server_accounts(id)
SET @fk := (
    SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites'
      AND COLUMN_NAME = 'used_by' AND REFERENCED_TABLE_NAME = 'server_accounts' LIMIT 1
);
SET @sql := IF(@fk IS NULL,
    'ALTER TABLE server_account_invites ADD CONSTRAINT fk_sai_used_by FOREIGN KEY (used_by) REFERENCES server_accounts(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
