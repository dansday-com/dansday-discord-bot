CREATE TABLE IF NOT EXISTS server_member_color_runs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    round INT NOT NULL DEFAULT 0,
    seed INT NOT NULL DEFAULT 0,
    guesses VARCHAR(96) NOT NULL DEFAULT '',
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    payout INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_color_runs' AND INDEX_NAME = 'idx_server_member_color_runs_member');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_member_color_runs_member ON server_member_color_runs (member_id, created_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
