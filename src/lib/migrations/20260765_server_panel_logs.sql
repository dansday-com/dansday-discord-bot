RENAME TABLE server_setting_logs TO server_panel_logs;

ALTER TABLE server_panel_logs ADD COLUMN server_id INT NULL AFTER id, ADD COLUMN action VARCHAR(24) NULL AFTER account_id;

UPDATE server_panel_logs l JOIN server_settings s ON s.id = l.server_setting_id SET l.server_id = s.server_id, l.action = s.component_name;

SET @fk := (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_panel_logs' AND COLUMN_NAME = 'server_setting_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @stmt := CONCAT('ALTER TABLE server_panel_logs DROP FOREIGN KEY ', @fk);
PREPARE s FROM @stmt;
EXECUTE s;
DEALLOCATE PREPARE s;

ALTER TABLE server_panel_logs DROP INDEX idx_server_setting_logs_setting, DROP COLUMN server_setting_id;

ALTER TABLE server_panel_logs
    MODIFY server_id INT NOT NULL,
    MODIFY action VARCHAR(24) NOT NULL,
    ADD FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    ADD INDEX idx_server_panel_logs_server (server_id, created_at);
