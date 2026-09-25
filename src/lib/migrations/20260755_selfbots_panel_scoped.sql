SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bots' AND COLUMN_NAME = 'panel_id');
SET @stmt := IF(@c = 0, 'ALTER TABLE server_bots ADD COLUMN panel_id INT NULL DEFAULT NULL AFTER server_id', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

SET @i := (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bots' AND INDEX_NAME = 'idx_server_bots_panel_id');
SET @stmt := IF(@i = 0, 'CREATE INDEX idx_server_bots_panel_id ON server_bots (panel_id)', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

UPDATE server_bots sb
JOIN servers sv ON sv.id = sb.server_id
JOIN bots b ON b.id = sv.bot_id
SET sb.panel_id = b.panel_id
WHERE sb.panel_id IS NULL;

SET @f := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_bots' AND CONSTRAINT_NAME = 'fk_server_bots_panel_id');
SET @stmt := IF(@f = 0, 'ALTER TABLE server_bots ADD CONSTRAINT fk_server_bots_panel_id FOREIGN KEY (panel_id) REFERENCES panels (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE server_bots MODIFY COLUMN server_id INT NULL;
