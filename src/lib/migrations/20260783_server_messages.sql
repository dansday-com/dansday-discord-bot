CREATE TABLE IF NOT EXISTS server_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    content JSON NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    INDEX idx_server_messages_server (server_id)
);

CREATE TABLE IF NOT EXISTS server_message_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    channel_id INT NOT NULL,
    discord_message_id VARCHAR(150) NOT NULL,
    language VARCHAR(10) NOT NULL,
    mentions TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_message_post (discord_message_id),
    FOREIGN KEY (message_id) REFERENCES server_messages(id) ON DELETE CASCADE,
    FOREIGN KEY (channel_id) REFERENCES server_channels(id) ON DELETE CASCADE,
    INDEX idx_server_message_posts_message (message_id)
);
