DROP TABLE IF EXISTS server_member_notifications;

CREATE TABLE IF NOT EXISTS server_member_notifications (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    member_id INT NOT NULL,
    channel_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_notification_channel (member_id, channel_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES server_channels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_member_notifications_channel ON server_member_notifications(channel_id);
