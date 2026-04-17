-- Drop the old table and recreate the new table
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

-- MySQL 8 doesn't support IF NOT EXISTS for CREATE INDEX, so we use a safe query
SET @idx_exists := (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_member_notifications'
      AND INDEX_NAME = 'idx_server_member_notifications_channel'
);
SET @sql_create_idx := IF(
    @idx_exists > 0,
    'SELECT 1',
    'CREATE INDEX idx_server_member_notifications_channel ON server_member_notifications(channel_id)'
);
PREPARE stmt_create_idx FROM @sql_create_idx;
EXECUTE stmt_create_idx;
DEALLOCATE PREPARE stmt_create_idx;
