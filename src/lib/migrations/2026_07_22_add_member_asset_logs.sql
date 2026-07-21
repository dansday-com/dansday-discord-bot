CREATE TABLE IF NOT EXISTS server_member_asset_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    action VARCHAR(8) NOT NULL,
    asset_type VARCHAR(24) NOT NULL DEFAULT 'crypto',
    asset_id VARCHAR(96) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    asset_image VARCHAR(255) NULL,
    xp_amount INT NOT NULL DEFAULT 0,
    price DECIMAL(30, 12) NOT NULL DEFAULT 0,
    net INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

DROP PROCEDURE IF EXISTS _add_idx_member_asset_logs;
CREATE PROCEDURE _add_idx_member_asset_logs()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_asset_logs' AND index_name = 'idx_server_member_asset_logs_member') THEN
        CREATE INDEX idx_server_member_asset_logs_member ON server_member_asset_logs(member_id, created_at);
    END IF;
END;
CALL _add_idx_member_asset_logs();
DROP PROCEDURE IF EXISTS _add_idx_member_asset_logs;
