CREATE TABLE IF NOT EXISTS server_bot_status (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_bot_id INT NOT NULL,
    discord_status ENUM('online', 'idle', 'dnd', 'invisible') NOT NULL DEFAULT 'online',
    activity_type ENUM('playing', 'streaming', 'listening', 'watching', 'custom', 'competing') NOT NULL DEFAULT 'playing',
    activity_name VARCHAR(128) NOT NULL DEFAULT '',
    activity_url TEXT NULL,
    activity_state VARCHAR(128) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_bot_status_server_bot_id (server_bot_id),
    FOREIGN KEY (server_bot_id) REFERENCES server_bots(id) ON DELETE CASCADE
);
