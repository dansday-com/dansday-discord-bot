SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_tasks' AND COLUMN_NAME = 'target_item_id');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_tasks ADD COLUMN target_item_id INT NULL AFTER baseline', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @fk := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_tasks' AND CONSTRAINT_NAME = 'fk_server_member_tasks_target_item');
SET @stmt := IF(@fk = 0, 'ALTER TABLE server_member_tasks ADD CONSTRAINT fk_server_member_tasks_target_item FOREIGN KEY (target_item_id) REFERENCES items(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
