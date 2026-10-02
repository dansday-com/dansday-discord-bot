CREATE TABLE IF NOT EXISTS server_member_invites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    inviter_member_id INT NULL,
    code VARCHAR(32) NULL,
    source VARCHAR(16) NOT NULL DEFAULT 'unknown',
    fake_reason VARCHAR(16) NULL,
    xp INT NOT NULL DEFAULT 0,
    rewarded_at DATETIME NULL,
    joined_at DATETIME NOT NULL,
    left_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_invite (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (inviter_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_invite_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    server_account_id INT NULL,
    account_id INT NULL,
    amount INT NOT NULL,
    reason TEXT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (server_account_id) REFERENCES server_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_invite_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    code VARCHAR(32) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_invite_link (member_id),
    UNIQUE KEY unique_member_invite_link_code (code),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invites' AND INDEX_NAME = 'idx_server_member_invites_inviter');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_invites_inviter ON server_member_invites (inviter_member_id, joined_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invites' AND INDEX_NAME = 'idx_server_member_invites_pending');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_invites_pending ON server_member_invites (rewarded_at, joined_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invite_logs' AND INDEX_NAME = 'idx_server_member_invite_logs_member');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_invite_logs_member ON server_member_invite_logs (member_id, created_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_giveaways' AND COLUMN_NAME = 'min_invites');
SET @stmt := IF(@c = 0, 'ALTER TABLE server_member_giveaways ADD COLUMN min_invites INT NOT NULL DEFAULT 0 AFTER winner_count', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
