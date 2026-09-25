CREATE TABLE IF NOT EXISTS panel_settings (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	panel_id INT NOT NULL,
	component_name VARCHAR(150) NOT NULL,
	settings JSON NOT NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY unique_panel_component (panel_id, component_name),
	KEY idx_panel_settings_panel_id (panel_id),
	CONSTRAINT fk_panel_settings_panel_id FOREIGN KEY (panel_id) REFERENCES panels (id) ON DELETE CASCADE
);

INSERT INTO panel_settings (panel_id, component_name, settings, created_at, updated_at)
SELECT p.id, 'discord_quest_notifier', CAST('{"auto_quest": false}' AS JSON), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM panels p
WHERE NOT EXISTS (
	SELECT 1 FROM panel_settings ps WHERE ps.panel_id = p.id AND ps.component_name = 'discord_quest_notifier'
);
