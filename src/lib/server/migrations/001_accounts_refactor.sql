-- Migration 001: Accounts refactor
-- Renames panel_accounts → accounts, panel_invite_links → account_invites
-- Expands account_type enum to include 'superadmin', 'owner', 'moderator'
-- Adds account_server_access, server_selfbot_assignments tables
--
-- Run this ONCE against an existing database before deploying the new code.
-- Safe to run multiple times (uses IF EXISTS / IF NOT EXISTS guards).

-- 1. Rename panel_accounts → accounts (only if old name exists, new name doesn't)
SET @panel_accounts_exists = (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'panel_accounts'
);
SET @accounts_exists = (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'accounts'
);
SET @sql = IF(@panel_accounts_exists > 0 AND @accounts_exists = 0,
    'RENAME TABLE panel_accounts TO accounts',
    'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Rename panel_invite_links → account_invites (only if old name exists, new name doesn't)
SET @invite_old_exists = (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'panel_invite_links'
);
SET @invite_new_exists = (
    SELECT COUNT(*) FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'account_invites'
);
SET @sql2 = IF(@invite_old_exists > 0 AND @invite_new_exists = 0,
    'RENAME TABLE panel_invite_links TO account_invites',
    'SELECT 1'
);
PREPARE stmt2 FROM @sql2;
EXECUTE stmt2;
DEALLOCATE PREPARE stmt2;

-- 2. Expand account_type enum on accounts table
ALTER TABLE accounts
    MODIFY COLUMN account_type ENUM('superadmin', 'owner', 'moderator') NOT NULL DEFAULT 'superadmin';

-- 3. Migrate existing 'admin' values → 'superadmin'
UPDATE accounts SET account_type = 'superadmin' WHERE account_type = 'admin';

-- 4. Expand account_type enum on account_invites table
ALTER TABLE account_invites
    MODIFY COLUMN account_type ENUM('superadmin', 'owner', 'moderator') NOT NULL;

-- 5. Add server_id column to account_invites (if not already there)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'account_invites'
      AND column_name = 'server_id'
);
SET @sql3 = IF(@col_exists = 0,
    'ALTER TABLE account_invites ADD COLUMN server_id INT NULL AFTER account_type, ADD FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE',
    'SELECT 1'
);
PREPARE stmt3 FROM @sql3;
EXECUTE stmt3;
DEALLOCATE PREPARE stmt3;

-- 6. Create account_server_access table (if not exists)
CREATE TABLE IF NOT EXISTS account_server_access (
    id INT PRIMARY KEY AUTO_INCREMENT,
    account_id INT NOT NULL,
    server_id INT NOT NULL,
    role ENUM('owner', 'moderator') NOT NULL,
    invited_by INT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_account_server (account_id, server_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES accounts(id) ON DELETE SET NULL
);

-- 7. Create server_selfbot_assignments table (if not exists)
CREATE TABLE IF NOT EXISTS server_selfbot_assignments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    selfbot_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_selfbot (server_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (selfbot_id) REFERENCES bots(id) ON DELETE CASCADE
);

-- 8. Add new indexes (conditional — MySQL does not support CREATE INDEX IF NOT EXISTS)
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='accounts' AND index_name='idx_accounts_email');
SET @s = IF(@i=0,'CREATE INDEX idx_accounts_email ON accounts(email)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='accounts' AND index_name='idx_accounts_username');
SET @s = IF(@i=0,'CREATE INDEX idx_accounts_username ON accounts(username)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='accounts' AND index_name='idx_accounts_panel_id');
SET @s = IF(@i=0,'CREATE INDEX idx_accounts_panel_id ON accounts(panel_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_invites' AND index_name='idx_account_invites_token');
SET @s = IF(@i=0,'CREATE INDEX idx_account_invites_token ON account_invites(token)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_invites' AND index_name='idx_account_invites_created_by');
SET @s = IF(@i=0,'CREATE INDEX idx_account_invites_created_by ON account_invites(created_by)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_invites' AND index_name='idx_account_invites_used_by');
SET @s = IF(@i=0,'CREATE INDEX idx_account_invites_used_by ON account_invites(used_by)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_invites' AND index_name='idx_account_invites_server_id');
SET @s = IF(@i=0,'CREATE INDEX idx_account_invites_server_id ON account_invites(server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_server_access' AND index_name='idx_account_server_access_account_id');
SET @s = IF(@i=0,'CREATE INDEX idx_account_server_access_account_id ON account_server_access(account_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='account_server_access' AND index_name='idx_account_server_access_server_id');
SET @s = IF(@i=0,'CREATE INDEX idx_account_server_access_server_id ON account_server_access(server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_selfbot_assignments' AND index_name='idx_server_selfbot_assignments_server_id');
SET @s = IF(@i=0,'CREATE INDEX idx_server_selfbot_assignments_server_id ON server_selfbot_assignments(server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_selfbot_assignments' AND index_name='idx_server_selfbot_assignments_selfbot_id');
SET @s = IF(@i=0,'CREATE INDEX idx_server_selfbot_assignments_selfbot_id ON server_selfbot_assignments(selfbot_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

-- 9. Drop connect_to column from bots (selfbot→official pairing now via server_selfbot_assignments)
-- Must drop the FK constraint first, then the column.
-- Use REFERENCED_TABLE_NAME to ensure we get the FK constraint, not just any index on the column.
SET @fk_name = (
    SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'connect_to'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    LIMIT 1
);
SET @drop_fk = IF(@fk_name IS NOT NULL,
    CONCAT('ALTER TABLE bots DROP FOREIGN KEY `', @fk_name, '`'),
    'SELECT 1'
);
PREPARE stmt_fk FROM @drop_fk;
EXECUTE stmt_fk;
DEALLOCATE PREPARE stmt_fk;

-- Also drop the index MySQL auto-created for the FK column, if it still exists
SET @idx_name = (
    SELECT INDEX_NAME FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'bots'
      AND COLUMN_NAME = 'connect_to'
      AND INDEX_NAME != 'PRIMARY'
    LIMIT 1
);
SET @drop_idx = IF(@idx_name IS NOT NULL,
    CONCAT('ALTER TABLE bots DROP INDEX `', @idx_name, '`'),
    'SELECT 1'
);
PREPARE stmt_idx FROM @drop_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;

-- Now drop the column itself
SET @col_connect_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE() AND table_name = 'bots' AND column_name = 'connect_to'
);
SET @drop_col = IF(@col_connect_exists > 0,
    'ALTER TABLE bots DROP COLUMN connect_to',
    'SELECT 1'
);
PREPARE stmt_col FROM @drop_col;
EXECUTE stmt_col;
DEALLOCATE PREPARE stmt_col;
