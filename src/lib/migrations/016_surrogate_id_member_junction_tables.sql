-- Member junction tables: add id PK + unique keys; pluralize panels, server_discord_orbs, server_feedbacks (and matching index names).

-- ========== server_member_content_creators ==========
SET @smcc_t = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_member_content_creators');
SET @smcc_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_content_creators' AND column_name = 'id');

SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_content_creators'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcc_t > 0 AND @smcc_id = 0 AND @fk IS NOT NULL,
  CONCAT('ALTER TABLE server_member_content_creators DROP FOREIGN KEY `', @fk, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smcc_t > 0 AND @smcc_id = 0, 'ALTER TABLE server_member_content_creators DROP PRIMARY KEY', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smcc_t > 0 AND @smcc_id = 0,
  'ALTER TABLE server_member_content_creators ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY unique_member_content_creator (member_id)',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @smcc_has_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_content_creators' AND column_name = 'id');
SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_content_creators'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcc_t > 0 AND @smcc_has_id > 0 AND @fk IS NULL,
  'ALTER TABLE server_member_content_creators ADD FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== server_member_custom_supporter_roles ==========
SET @smcsr_t = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_member_custom_supporter_roles');
SET @smcsr_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_custom_supporter_roles' AND column_name = 'id');

SET @fk_m := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_custom_supporter_roles'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcsr_t > 0 AND @smcsr_id = 0 AND @fk_m IS NOT NULL,
  CONCAT('ALTER TABLE server_member_custom_supporter_roles DROP FOREIGN KEY `', @fk_m, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_r := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_custom_supporter_roles'
    AND COLUMN_NAME = 'role_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcsr_t > 0 AND @smcsr_id = 0 AND @fk_r IS NOT NULL,
  CONCAT('ALTER TABLE server_member_custom_supporter_roles DROP FOREIGN KEY `', @fk_r, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smcsr_t > 0 AND @smcsr_id = 0, 'ALTER TABLE server_member_custom_supporter_roles DROP PRIMARY KEY', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smcsr_t > 0 AND @smcsr_id = 0,
  'ALTER TABLE server_member_custom_supporter_roles ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY unique_member_custom_supporter_role (member_id, role_id)',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @smcsr_has_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_custom_supporter_roles' AND column_name = 'id');
SET @fk_m := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_custom_supporter_roles'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcsr_t > 0 AND @smcsr_has_id > 0 AND @fk_m IS NULL,
  'ALTER TABLE server_member_custom_supporter_roles ADD FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_r := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_custom_supporter_roles'
    AND COLUMN_NAME = 'role_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smcsr_t > 0 AND @smcsr_has_id > 0 AND @fk_r IS NULL,
  'ALTER TABLE server_member_custom_supporter_roles ADD FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== server_member_notifications ==========
SET @smn_t = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_member_notifications');
SET @smn_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_notifications' AND column_name = 'id');

SET @fk_m := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_notifications'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smn_t > 0 AND @smn_id = 0 AND @fk_m IS NOT NULL,
  CONCAT('ALTER TABLE server_member_notifications DROP FOREIGN KEY `', @fk_m, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_r := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_notifications'
    AND COLUMN_NAME = 'role_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smn_t > 0 AND @smn_id = 0 AND @fk_r IS NOT NULL,
  CONCAT('ALTER TABLE server_member_notifications DROP FOREIGN KEY `', @fk_r, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smn_t > 0 AND @smn_id = 0, 'ALTER TABLE server_member_notifications DROP PRIMARY KEY', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smn_t > 0 AND @smn_id = 0,
  'ALTER TABLE server_member_notifications ADD COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST, ADD UNIQUE KEY unique_member_notification_role (member_id, role_id)',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @smn_has_id = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_member_notifications' AND column_name = 'id');
SET @fk_m := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_notifications'
    AND COLUMN_NAME = 'member_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smn_t > 0 AND @smn_has_id > 0 AND @fk_m IS NULL,
  'ALTER TABLE server_member_notifications ADD FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_r := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_notifications'
    AND COLUMN_NAME = 'role_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@smn_t > 0 AND @smn_has_id > 0 AND @fk_r IS NULL,
  'ALTER TABLE server_member_notifications ADD FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Plural table names: panel, server_discord_orb, server_feedback
SET @old_panel = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'panel');
SET @new_panel = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'panels');
SET @s = IF(@old_panel > 0 AND @new_panel = 0, 'RENAME TABLE panel TO panels', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @old_orb = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_discord_orb');
SET @new_orb = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_discord_orbs');
SET @s = IF(@old_orb > 0 AND @new_orb = 0, 'RENAME TABLE server_discord_orb TO server_discord_orbs', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_orb_u = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_discord_orbs' AND index_name = 'unique_server_discord_orb_quest');
SET @s = IF(@ix_orb_u > 0, 'ALTER TABLE server_discord_orbs RENAME INDEX unique_server_discord_orb_quest TO unique_server_discord_orbs_quest', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_orb_i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_discord_orbs' AND index_name = 'idx_server_discord_orb_server_id');
SET @s = IF(@ix_orb_i > 0, 'ALTER TABLE server_discord_orbs RENAME INDEX idx_server_discord_orb_server_id TO idx_server_discord_orbs_server_id', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @old_fb = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_feedback');
SET @new_fb = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'server_feedbacks');
SET @s = IF(@old_fb > 0 AND @new_fb = 0, 'RENAME TABLE server_feedback TO server_feedbacks', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_fb = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_feedbacks' AND index_name = 'idx_server_feedback_member');
SET @s = IF(@ix_fb > 0, 'ALTER TABLE server_feedbacks RENAME INDEX idx_server_feedback_member TO idx_server_feedbacks_member', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
