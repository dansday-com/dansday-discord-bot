CREATE TABLE IF NOT EXISTS server_member_xp_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    source VARCHAR(24) NOT NULL,
    amount INT NOT NULL DEFAULT 0,
    multiplier DECIMAL(6,2) NULL,
    skim_percent INT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_server_member_xp_logs_member (member_id, created_at),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
