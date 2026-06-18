CREATE TABLE IF NOT EXISTS server_member_item_event_notifs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    kind VARCHAR(24) NOT NULL,
    event_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_item_event (member_id, kind, event_at),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
