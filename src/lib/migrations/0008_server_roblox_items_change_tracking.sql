SET @col1 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_roblox_items' AND COLUMN_NAME = 'last_price');
SET @sql1 := IF(@col1 > 0, 'SELECT 1', 'ALTER TABLE server_roblox_items ADD COLUMN last_price INT NULL');
PREPARE stmt1 FROM @sql1; EXECUTE stmt1; DEALLOCATE PREPARE stmt1;

SET @col2 := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_roblox_items' AND COLUMN_NAME = 'last_total_quantity');
SET @sql2 := IF(@col2 > 0, 'SELECT 1', 'ALTER TABLE server_roblox_items ADD COLUMN last_total_quantity INT NULL');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;
