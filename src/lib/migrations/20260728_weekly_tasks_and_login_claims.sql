SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_daily_tasks' AND COLUMN_NAME = 'period');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_daily_tasks ADD COLUMN period VARCHAR(8) NOT NULL DEFAULT ''daily'' AFTER member_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_daily_tasks' AND INDEX_NAME = 'unique_server_member_daily_task');
SET @stmt := IF(@idx > 0, 'ALTER TABLE server_member_daily_tasks DROP INDEX unique_server_member_daily_task', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE server_member_daily_tasks ADD UNIQUE KEY unique_server_member_daily_task (member_id, period, day_key, slot);

SET @idx := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_daily_tasks' AND INDEX_NAME = 'idx_server_member_daily_tasks_member');
SET @stmt := IF(@idx > 0, 'ALTER TABLE server_member_daily_tasks DROP INDEX idx_server_member_daily_tasks_member', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE server_member_daily_tasks ADD INDEX idx_server_member_daily_tasks_member (member_id, period, day_key);

CREATE TABLE IF NOT EXISTS server_member_login_claims (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    cycle_day TINYINT NOT NULL DEFAULT 0,
    last_claim_day_key INT NULL,
    cycles_completed INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_login_claim (member_id),
    KEY idx_server_member_login_claims_member (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
