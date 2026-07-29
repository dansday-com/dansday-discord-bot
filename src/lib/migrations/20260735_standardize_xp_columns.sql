SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_levels' AND COLUMN_NAME = 'experience');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_levels' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_levels CHANGE COLUMN experience xp INT DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_item_logs' AND COLUMN_NAME = 'xp_amount');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_item_logs' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_item_logs CHANGE COLUMN xp_amount xp INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_minigame_logs' AND COLUMN_NAME = 'xp_amount');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_minigame_logs' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_minigame_logs CHANGE COLUMN xp_amount xp INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_asset_logs' AND COLUMN_NAME = 'xp_amount');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_asset_logs' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_asset_logs CHANGE COLUMN xp_amount xp INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_logs' AND COLUMN_NAME = 'amount');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_logs' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_level_logs CHANGE COLUMN amount xp INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_logs' AND COLUMN_NAME = 'total_xp');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_level_logs' AND COLUMN_NAME = 'xp_total');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_level_logs CHANGE COLUMN total_xp xp_total BIGINT NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_item_bounties' AND COLUMN_NAME = 'amount');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_item_bounties' AND COLUMN_NAME = 'xp');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_item_bounties CHANGE COLUMN amount xp INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_tasks' AND COLUMN_NAME = 'reward_xp');
SET @n := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_tasks' AND COLUMN_NAME = 'xp_reward');
SET @stmt := IF(@c = 1 AND @n = 0, 'ALTER TABLE server_member_tasks CHANGE COLUMN reward_xp xp_reward INT NOT NULL DEFAULT 0', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
