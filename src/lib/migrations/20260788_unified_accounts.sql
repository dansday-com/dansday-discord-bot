SET @has_server_accounts = (SELECT COUNT(*) > 0 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_accounts');
SET @has_login_columns = (SELECT COUNT(*) > 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_accounts' AND COLUMN_NAME = 'email');
SET @has_account_id = (SELECT COUNT(*) > 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_accounts' AND COLUMN_NAME = 'account_id');
SET @are_logs_remapped = (SELECT COUNT(*) = 0 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_panel_logs' AND COLUMN_NAME = 'server_account_id');

SET @sql = IF(@has_server_accounts, 'DELETE sa FROM server_accounts sa LEFT JOIN servers s ON s.id = sa.server_id WHERE s.id IS NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

ALTER TABLE accounts MODIFY account_type ENUM('superadmin', 'user') NOT NULL DEFAULT 'user';

SET @sql = IF(@has_login_columns,
    'INSERT INTO accounts (username, email, password_hash, account_type, ip_address, created_at, updated_at)
     SELECT sa.username, sa.email, sa.password_hash, ''user'', sa.ip_address, sa.created_at, sa.updated_at FROM server_accounts sa
     WHERE sa.id IN (SELECT MAX(id) FROM server_accounts GROUP BY email) AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.email = sa.email)',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites' AND COLUMN_NAME = 'used_by' AND REFERENCED_TABLE_NAME = 'server_accounts' LIMIT 1);
SET @sql = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_panel_logs' AND COLUMN_NAME = 'server_account_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE server_panel_logs DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invite_logs' AND COLUMN_NAME = 'server_account_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = IF(@fk IS NULL, 'SELECT 1', CONCAT('ALTER TABLE server_member_invite_logs DROP FOREIGN KEY `', @fk, '`'));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@are_logs_remapped, 'SELECT 1',
    'UPDATE server_account_invites i JOIN server_accounts sa ON sa.id = i.used_by JOIN accounts a ON a.email = sa.email SET i.used_by = a.id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@are_logs_remapped, 'SELECT 1',
    'UPDATE server_panel_logs l JOIN server_accounts sa ON sa.id = l.server_account_id JOIN accounts a ON a.email = sa.email SET l.account_id = a.id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@are_logs_remapped, 'SELECT 1',
    'UPDATE server_member_invite_logs l JOIN server_accounts sa ON sa.id = l.server_account_id JOIN accounts a ON a.email = sa.email SET l.account_id = a.id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@are_logs_remapped, 'SELECT 1', 'ALTER TABLE server_panel_logs DROP COLUMN server_account_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@are_logs_remapped, 'SELECT 1', 'ALTER TABLE server_member_invite_logs DROP COLUMN server_account_id');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_server_accounts AND NOT @has_account_id, 'ALTER TABLE server_accounts ADD COLUMN account_id INT NULL AFTER id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_login_columns, 'UPDATE server_accounts sa JOIN accounts a ON a.email = sa.email SET sa.account_id = a.id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_login_columns,
    'ALTER TABLE server_accounts
        DROP INDEX unique_email_server,
        DROP INDEX unique_username_server,
        DROP INDEX idx_server_accounts_email,
        DROP COLUMN username,
        DROP COLUMN email,
        DROP COLUMN password_hash,
        DROP COLUMN ip_address,
        MODIFY account_id INT NOT NULL,
        ADD UNIQUE KEY uq_account_servers (account_id, server_id),
        ADD FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE',
    'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites' AND COLUMN_NAME = 'used_by' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = IF(@has_server_accounts AND @fk IS NULL, 'ALTER TABLE server_account_invites ADD FOREIGN KEY (used_by) REFERENCES accounts(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_server_accounts, 'RENAME TABLE server_accounts TO account_servers, server_account_invites TO account_invites', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DELETE a FROM accounts a LEFT JOIN account_servers s ON s.account_id = a.id WHERE a.account_type = 'user' AND s.id IS NULL;
