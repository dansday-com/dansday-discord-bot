CREATE TABLE IF NOT EXISTS server_member_moderation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    staff_member_id INT NULL,
    case_number INT NOT NULL,
    action VARCHAR(16) NOT NULL,
    reason TEXT NULL,
    duration_seconds INT NULL,
    expires_at DATETIME NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    source VARCHAR(16) NOT NULL DEFAULT 'panel',
    revoked_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (staff_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_moderation_logs' AND INDEX_NAME = 'idx_server_member_moderation_logs_member');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_moderation_logs_member ON server_member_moderation_logs (member_id, created_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_moderation_logs' AND INDEX_NAME = 'idx_server_member_moderation_logs_expiry');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_moderation_logs_expiry ON server_member_moderation_logs (action, active, expires_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
