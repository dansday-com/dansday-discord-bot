CREATE TABLE IF NOT EXISTS server_member_assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    asset_type VARCHAR(24) NOT NULL DEFAULT 'crypto',
    asset_id VARCHAR(96) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    asset_image VARCHAR(255) NULL,
    xp_invested INT NOT NULL DEFAULT 0,
    buy_price DECIMAL(30, 12) NOT NULL,
    opened_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

DROP PROCEDURE IF EXISTS _add_idx_member_assets;
CREATE PROCEDURE _add_idx_member_assets()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_assets' AND index_name = 'idx_server_member_assets_member') THEN
        CREATE INDEX idx_server_member_assets_member ON server_member_assets(member_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_assets' AND index_name = 'idx_server_member_assets_held') THEN
        CREATE INDEX idx_server_member_assets_held ON server_member_assets(asset_type, asset_id);
    END IF;
END;
CALL _add_idx_member_assets();
DROP PROCEDURE IF EXISTS _add_idx_member_assets;
