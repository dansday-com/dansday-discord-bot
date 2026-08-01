CREATE TABLE IF NOT EXISTS bot_wikis (
	id INT AUTO_INCREMENT PRIMARY KEY,
	bot_id INT NOT NULL,
	enabled TINYINT(1) NOT NULL DEFAULT 1,
	name VARCHAR(64) NOT NULL,
	api_url VARCHAR(512) NOT NULL,
	site_url VARCHAR(512) NULL,
	description VARCHAR(255) NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY uq_bot_wikis_bot_name (bot_id, name),
	KEY idx_bot_wikis_bot (bot_id),
	CONSTRAINT fk_bot_wikis_bot FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
);
