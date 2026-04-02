CREATE TABLE IF NOT EXISTS server_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    server_id INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    account_type ENUM('owner', 'moderator') NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(6) NULL,
    otp_expires_at DATETIME NULL,
    is_frozen BOOLEAN DEFAULT FALSE,
    invited_by INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_email_bot_server (email, bot_id, server_id),
    UNIQUE KEY unique_username_bot_server (username, bot_id, server_id),
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES server_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_account_invites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token VARCHAR(255) NOT NULL UNIQUE,
    bot_id INT NOT NULL,
    server_id INT NOT NULL,
    account_type ENUM('owner', 'moderator') NOT NULL,
    created_by INT NOT NULL,
    used_by INT NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES server_accounts(id) ON DELETE SET NULL
);

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='idx_server_accounts_bot_server');
SET @s = IF(@i=0,'CREATE INDEX idx_server_accounts_bot_server ON server_accounts(bot_id, server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='idx_server_accounts_email');
SET @s = IF(@i=0,'CREATE INDEX idx_server_accounts_email ON server_accounts(email)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND index_name='idx_server_account_invites_token');
SET @s = IF(@i=0,'CREATE INDEX idx_server_account_invites_token ON server_account_invites(token)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND index_name='idx_server_account_invites_bot_server');
SET @s = IF(@i=0,'CREATE INDEX idx_server_account_invites_bot_server ON server_account_invites(bot_id, server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

INSERT IGNORE INTO server_accounts (bot_id, server_id, username, email, password_hash, account_type, email_verified, otp_code, otp_expires_at, is_frozen, invited_by, created_at, updated_at)
SELECT s.bot_id, asa.server_id, a.username, a.email, a.password_hash, asa.role, a.email_verified, a.otp_code, a.otp_expires_at, a.is_frozen, NULL, a.created_at, a.updated_at
FROM accounts a
JOIN account_server_access asa ON asa.account_id = a.id
JOIN servers s ON s.id = asa.server_id
WHERE a.account_type IN ('owner', 'moderator');

DELETE FROM accounts WHERE account_type IN ('owner', 'moderator');

ALTER TABLE accounts MODIFY COLUMN account_type ENUM('superadmin') NOT NULL DEFAULT 'superadmin';

DROP TABLE IF EXISTS account_invites;
DROP TABLE IF EXISTS account_server_access;
