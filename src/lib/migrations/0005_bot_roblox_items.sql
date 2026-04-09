-- Migration 0005: Add Roblox catalog item tables (bot_roblox_items + server_roblox_items)

CREATE TABLE IF NOT EXISTS bot_roblox_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    asset_id BIGINT NOT NULL,
    item_type VARCHAR(32) NOT NULL DEFAULT 'Asset',
    asset_type INT NULL,
    name TEXT NULL,
    description TEXT NULL,
    creator_type VARCHAR(32) NOT NULL DEFAULT '',
    creator_target_id BIGINT NULL,
    creator_name TEXT NULL,
    price INT NULL,
    lowest_price INT NULL,
    lowest_resale_price INT NULL,
    total_quantity INT NULL,
    collectible_item_id VARCHAR(64) NULL,
    item_created_at DATETIME NULL,
    is_free BOOLEAN NOT NULL DEFAULT FALSE,
    is_limited BOOLEAN NOT NULL DEFAULT FALSE,
    is_official BOOLEAN NOT NULL DEFAULT FALSE,
    item_url VARCHAR(512) NULL,
    notified_at DATETIME NOT NULL,
    UNIQUE KEY unique_bot_roblox_items_asset (asset_id),
    INDEX idx_bot_roblox_items_bot_id (bot_id),
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_roblox_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    item_id INT NOT NULL,
    message_posted_at DATETIME NULL,
    UNIQUE KEY unique_server_roblox_items (server_id, item_id),
    INDEX idx_server_roblox_items_server_id (server_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES bot_roblox_items(id) ON DELETE CASCADE
);

