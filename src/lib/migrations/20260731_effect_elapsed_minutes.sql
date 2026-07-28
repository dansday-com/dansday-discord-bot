SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_item_actives' AND COLUMN_NAME = 'elapsed_minutes');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_item_actives ADD COLUMN elapsed_minutes INT NOT NULL DEFAULT 0 AFTER expiry_notified', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
