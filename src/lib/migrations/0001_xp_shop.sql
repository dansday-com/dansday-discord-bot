CREATE TABLE IF NOT EXISTS items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    panel_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    effect_type VARCHAR(32) NOT NULL,
    description TEXT NULL,
    cost INT NOT NULL DEFAULT 0,
    config JSON NOT NULL DEFAULT ('{}'),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    available_from DATETIME NULL,
    available_to DATETIME NULL,
    recurring_schedule JSON NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_items_panel_id (panel_id),
    INDEX idx_items_enabled (panel_id, enabled),
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE
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
    INDEX idx_server_member_items_member (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_item_actives (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_item_id INT NOT NULL,
    effect_value DECIMAL(6,2) NOT NULL DEFAULT 0,
    beneficiary_member_id INT NULL,
    expires_at DATETIME NOT NULL,
    expiry_notified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    INDEX idx_server_member_item_actives_active (member_item_id, expires_at),
    INDEX idx_server_member_item_actives_beneficiary (beneficiary_member_id, expires_at),
    INDEX idx_server_member_item_actives_sweep (expiry_notified, expires_at),
    FOREIGN KEY (member_item_id) REFERENCES server_member_items(id) ON DELETE CASCADE,
    FOREIGN KEY (beneficiary_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_item_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_item_id INT NOT NULL,
    target_member_id INT NULL,
    action VARCHAR(32) NOT NULL,
    xp_amount INT NOT NULL DEFAULT 0,
    outcome VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL,
    INDEX idx_server_member_item_logs_item (member_item_id, created_at),
    INDEX idx_server_member_item_logs_target (target_member_id, created_at),
    FOREIGN KEY (member_item_id) REFERENCES server_member_items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_item_bounties (
    id INT PRIMARY KEY AUTO_INCREMENT,
    target_member_id INT NOT NULL,
    placed_by_member_id INT NULL,
    amount INT NOT NULL DEFAULT 0,
    collected BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    INDEX idx_server_member_item_bounties_target (target_member_id, collected),
    FOREIGN KEY (target_member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (placed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_item_notifications (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    notification_type VARCHAR(24) NOT NULL,
    notified_for_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_item_notification (member_id, notification_type, notified_for_at),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
