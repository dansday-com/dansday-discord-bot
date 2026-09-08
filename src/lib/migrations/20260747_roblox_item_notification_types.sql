SET @col := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_roblox_item_notifications' AND COLUMN_NAME = 'types');
SET @stmt := IF(@col = 0, 'ALTER TABLE server_member_roblox_item_notifications ADD COLUMN types VARCHAR(191) NOT NULL DEFAULT ''price,lowest_resale_price,units_available,total_quantity'' AFTER item_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;
