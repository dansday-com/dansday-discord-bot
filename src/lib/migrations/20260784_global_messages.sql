CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    panel_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    content JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE,
    INDEX idx_messages_panel (panel_id)
);

CREATE TABLE IF NOT EXISTS message_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    channel_id INT NOT NULL,
    discord_message_id VARCHAR(150) NOT NULL,
    language VARCHAR(10) NOT NULL,
    mentions TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_global_message_post (discord_message_id),
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES server_channels(id) ON DELETE CASCADE,
    INDEX idx_message_posts_message (message_id)
);
