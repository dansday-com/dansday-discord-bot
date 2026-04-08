-- Migration 0001: Replace server_discord_orbs with bot_discord_orbs catalog + server_discord_orbs join table

-- 1. Create global orb catalog keyed by Discord quest_id
CREATE TABLE IF NOT EXISTS bot_discord_orbs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    quest_id VARCHAR(64) NOT NULL,
    quest_task_type VARCHAR(64) NOT NULL DEFAULT '',
    quest_task_label VARCHAR(128) NOT NULL DEFAULT '',
    quest_name TEXT NULL,
    game_title TEXT NULL,
    quest_url VARCHAR(512) NULL,
    quest_description TEXT NULL,
    orb_hint TEXT NULL,
    rewards_line TEXT NULL,
    task_detail_line TEXT NULL,
    starts_at DATETIME NULL,
    expires_at DATETIME NULL,
    notified_at DATETIME NOT NULL,
    UNIQUE KEY unique_bot_discord_orbs_quest (quest_id),
    INDEX idx_bot_discord_orbs_bot_id (bot_id),
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

-- 2. Migrate existing rows into the catalog (bot_id=0 placeholder, repopulated on next sync)
INSERT IGNORE INTO bot_discord_orbs (
    bot_id,
    quest_id,
    quest_task_type,
    quest_task_label,
    quest_name,
    game_title,
    quest_url,
    quest_description,
    orb_hint,
    rewards_line,
    task_detail_line,
    starts_at,
    expires_at,
    notified_at
)
SELECT
    0,
    discord_quest_id,
    quest_task_type,
    quest_task_label,
    quest_name,
    game_title,
    quest_url,
    quest_description,
    orb_hint,
    rewards_line,
    task_detail_line,
    starts_at,
    expires_at,
    notified_at
FROM server_discord_orbs;

-- 3. Drop FK on server_discord_orbs.server_id before dropping the table
SET @fk_sdo_server := (
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'server_discord_orbs'
      AND COLUMN_NAME = 'server_id'
      AND REFERENCED_TABLE_NAME = 'servers'
    LIMIT 1
);
SET @sql_drop_fk_sdo_server := IF(
    @fk_sdo_server IS NULL,
    'SELECT 1',
    CONCAT('ALTER TABLE server_discord_orbs DROP FOREIGN KEY ', @fk_sdo_server)
);
PREPARE stmt_drop_fk_sdo_server FROM @sql_drop_fk_sdo_server;
EXECUTE stmt_drop_fk_sdo_server;
DEALLOCATE PREPARE stmt_drop_fk_sdo_server;

-- 4. Drop old server_discord_orbs table
DROP TABLE IF EXISTS server_discord_orbs;

-- 5. Recreate server_discord_orbs as lean join table
CREATE TABLE IF NOT EXISTS server_discord_orbs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    quest_id INT NOT NULL,
    message_posted_at DATETIME NULL,
    UNIQUE KEY unique_server_discord_orbs (server_id, quest_id),
    INDEX idx_server_discord_orbs_server_id (server_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (quest_id) REFERENCES bot_discord_orbs(id) ON DELETE CASCADE
);
