SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_invite_links' AND COLUMN_NAME = 'slug');
SET @stmt := IF(@c = 0, 'ALTER TABLE server_member_invite_links ADD COLUMN slug VARCHAR(32) NULL AFTER code, ADD UNIQUE KEY unique_member_invite_link_slug (slug)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
