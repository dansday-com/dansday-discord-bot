SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invites' AND COLUMN_NAME = 'share_xp');
SET @stmt := IF(@c = 0, 'ALTER TABLE server_member_invites ADD COLUMN share_xp BIGINT NOT NULL DEFAULT 0 AFTER xp', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
