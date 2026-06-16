CREATE TABLE IF NOT EXISTS bot_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    effect_type VARCHAR(32) NOT NULL,
    category VARCHAR(16) NOT NULL,
    description TEXT NULL,
    cost INT NOT NULL DEFAULT 0,
    config JSON NOT NULL DEFAULT ('{}'),
    icon VARCHAR(255) NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    available_from DATETIME NULL,
    available_to DATETIME NULL,
    recurring_schedule JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    acquired_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_member_item (member_id, item_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES bot_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_item_actives (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_item_id INT NOT NULL,
    magnitude DECIMAL(6,2) NOT NULL DEFAULT 0,
    source_member_id INT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_item_id) REFERENCES server_member_items(id) ON DELETE CASCADE,
    FOREIGN KEY (source_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_item_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_item_id INT NOT NULL,
    target_member_id INT NULL,
    action VARCHAR(32) NOT NULL,
    xp_amount INT NOT NULL DEFAULT 0,
    outcome VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_item_id) REFERENCES server_member_items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_bounties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    target_member_id INT NOT NULL,
    placed_by_member_id INT NULL,
    amount INT NOT NULL DEFAULT 0,
    collected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (target_member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (placed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_cosmetics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    cosmetic_kind VARCHAR(16) NOT NULL,
    value VARCHAR(64) NOT NULL,
    item_id INT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_cosmetic_kind (member_id, cosmetic_kind),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES bot_items(id) ON DELETE SET NULL
);

ALTER TABLE server_member_levels ADD COLUMN vault_xp INT NOT NULL DEFAULT 0;

CREATE INDEX idx_bot_items_bot_id ON bot_items(bot_id);
CREATE INDEX idx_bot_items_enabled ON bot_items(bot_id, enabled);
CREATE INDEX idx_server_member_items_member ON server_member_items(member_id);
CREATE INDEX idx_server_member_item_actives_active ON server_member_item_actives(member_item_id, expires_at);
CREATE INDEX idx_server_member_item_actives_source ON server_member_item_actives(source_member_id, expires_at);
CREATE INDEX idx_server_member_item_logs_item ON server_member_item_logs(member_item_id, created_at);
CREATE INDEX idx_server_member_item_logs_target ON server_member_item_logs(target_member_id, created_at);
CREATE INDEX idx_server_member_bounties_target ON server_member_bounties(target_member_id, collected);
CREATE INDEX idx_server_member_cosmetics_member ON server_member_cosmetics(member_id);
