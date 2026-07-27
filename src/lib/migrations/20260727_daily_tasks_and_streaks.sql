SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_levels' AND COLUMN_NAME = 'reactions_given');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_levels ADD COLUMN reactions_given INT DEFAULT 0 AFTER chat_total', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

CREATE TABLE IF NOT EXISTS server_member_daily_tasks (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    day_key INT NOT NULL,
    slot TINYINT NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    difficulty VARCHAR(8) NOT NULL,
    goal INT NOT NULL DEFAULT 1,
    baseline INT NOT NULL DEFAULT 0,
    reward_kind VARCHAR(8) NOT NULL,
    reward_xp INT NOT NULL DEFAULT 0,
    reward_item_id INT NULL,
    claimed_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_member_daily_task (member_id, day_key, slot),
    KEY idx_server_member_daily_tasks_member (member_id, day_key),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_item_id) REFERENCES items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_member_streaks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    current_streak INT NOT NULL DEFAULT 0,
    longest_streak INT NOT NULL DEFAULT 0,
    last_claim_day_key INT NULL,
    freezes_available INT NOT NULL DEFAULT 2,
    total_claims INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_streak (member_id),
    KEY idx_server_member_streaks_member (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
