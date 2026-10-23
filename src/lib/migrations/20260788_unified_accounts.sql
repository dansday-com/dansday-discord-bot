ALTER TABLE accounts MODIFY account_type ENUM('superadmin', 'user') NOT NULL DEFAULT 'user';

INSERT INTO accounts (username, email, password_hash, account_type, ip_address, created_at, updated_at)
SELECT username, email, password_hash, 'user', ip_address, created_at, updated_at FROM server_accounts
WHERE id IN (SELECT MAX(id) FROM server_accounts GROUP BY email);

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_account_invites' AND COLUMN_NAME = 'used_by' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY `', @fk, '`');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_panel_logs' AND COLUMN_NAME = 'server_account_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = CONCAT('ALTER TABLE server_panel_logs DROP FOREIGN KEY `', @fk, '`');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invite_logs' AND COLUMN_NAME = 'server_account_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @sql = CONCAT('ALTER TABLE server_member_invite_logs DROP FOREIGN KEY `', @fk, '`');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE server_account_invites i JOIN server_accounts sa ON sa.id = i.used_by JOIN accounts a ON a.email = sa.email SET i.used_by = a.id;
UPDATE server_panel_logs l JOIN server_accounts sa ON sa.id = l.server_account_id JOIN accounts a ON a.email = sa.email SET l.account_id = a.id;
UPDATE server_member_invite_logs l JOIN server_accounts sa ON sa.id = l.server_account_id JOIN accounts a ON a.email = sa.email SET l.account_id = a.id;

ALTER TABLE server_panel_logs DROP COLUMN server_account_id;
ALTER TABLE server_member_invite_logs DROP COLUMN server_account_id;

ALTER TABLE server_accounts ADD COLUMN account_id INT NULL AFTER id;
UPDATE server_accounts sa JOIN accounts a ON a.email = sa.email SET sa.account_id = a.id;

ALTER TABLE server_accounts
    DROP INDEX unique_email_server,
    DROP INDEX unique_username_server,
    DROP INDEX idx_server_accounts_email,
    DROP COLUMN username,
    DROP COLUMN email,
    DROP COLUMN password_hash,
    DROP COLUMN ip_address,
    MODIFY account_id INT NOT NULL,
    ADD UNIQUE KEY uq_account_servers (account_id, server_id),
    ADD FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE server_account_invites ADD FOREIGN KEY (used_by) REFERENCES accounts(id) ON DELETE SET NULL;

RENAME TABLE server_accounts TO account_servers, server_account_invites TO account_invites;
