CREATE TABLE IF NOT EXISTS server_member_roblox_item_notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    item_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_roblox_item_notification (member_id, item_id),
    KEY idx_server_member_roblox_item_notifications_item (item_id),
    CONSTRAINT fk_server_member_roblox_item_notifications_member FOREIGN KEY (member_id) REFERENCES server_members (id) ON DELETE CASCADE,
    CONSTRAINT fk_server_member_roblox_item_notifications_item FOREIGN KEY (item_id) REFERENCES bot_roblox_items (id) ON DELETE CASCADE
);
