CREATE TABLE IF NOT EXISTS server_discord_orb (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    discord_quest_id VARCHAR(64) NOT NULL,
    quest_task_type VARCHAR(64) NOT NULL DEFAULT '',
    quest_task_label VARCHAR(128) NOT NULL DEFAULT '',
    notified_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_discord_orb_quest (server_id, discord_quest_id),
    INDEX idx_server_discord_orb_server_id (server_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);
