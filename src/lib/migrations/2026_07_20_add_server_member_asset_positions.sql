CREATE TABLE IF NOT EXISTS server_member_asset_positions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    asset_type VARCHAR(24) NOT NULL DEFAULT 'crypto',
    asset_id VARCHAR(96) NOT NULL,
    symbol VARCHAR(32) NOT NULL,
    asset_name VARCHAR(128) NOT NULL,
    asset_image VARCHAR(255) NULL,
    xp_invested INT NOT NULL DEFAULT 0,
    buy_price DECIMAL(30, 12) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'open',
    opened_at DATETIME NOT NULL,
    closed_at DATETIME NULL,
    sell_price DECIMAL(30, 12) NULL,
    xp_returned INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

DROP PROCEDURE IF EXISTS _add_idx_asset_positions;
CREATE PROCEDURE _add_idx_asset_positions()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_asset_positions' AND index_name = 'idx_server_member_asset_positions_member') THEN
        CREATE INDEX idx_server_member_asset_positions_member ON server_member_asset_positions(member_id, status);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_asset_positions' AND index_name = 'idx_server_member_asset_positions_held') THEN
        CREATE INDEX idx_server_member_asset_positions_held ON server_member_asset_positions(status, asset_type, asset_id);
    END IF;
END;
CALL _add_idx_asset_positions();
DROP PROCEDURE IF EXISTS _add_idx_asset_positions;
