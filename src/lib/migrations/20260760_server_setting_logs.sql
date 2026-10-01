CREATE TABLE IF NOT EXISTS server_setting_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    server_setting_id INT NOT NULL,
    server_account_id INT NULL,
    account_id INT NULL,
    changes JSON NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (server_setting_id) REFERENCES server_settings(id) ON DELETE CASCADE,
    FOREIGN KEY (server_account_id) REFERENCES server_accounts(id) ON DELETE SET NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_setting_logs' AND INDEX_NAME = 'idx_server_setting_logs_setting');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_setting_logs_setting ON server_setting_logs (server_setting_id, created_at)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
