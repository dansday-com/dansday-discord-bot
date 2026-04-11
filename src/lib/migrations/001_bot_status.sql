CREATE TABLE IF NOT EXISTS bot_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    discord_status ENUM('online', 'idle', 'dnd', 'invisible') NOT NULL DEFAULT 'online',
    activity_type ENUM('playing', 'streaming', 'listening', 'watching', 'custom', 'competing') NOT NULL DEFAULT 'playing',
    activity_name VARCHAR(128) NOT NULL DEFAULT '',
    activity_url TEXT NULL,
    activity_state VARCHAR(128) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_bot_status_bot_id (bot_id),
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);
