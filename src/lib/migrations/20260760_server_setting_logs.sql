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

CREATE INDEX IF NOT EXISTS idx_server_setting_logs_setting ON server_setting_logs(server_setting_id, created_at);
