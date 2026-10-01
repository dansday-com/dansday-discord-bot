CREATE TABLE IF NOT EXISTS bot_creators (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	bot_id INT NOT NULL,
	platform ENUM('youtube', 'twitch', 'tiktok') NOT NULL,
	account_id VARCHAR(64) NOT NULL,
	handle VARCHAR(191) NULL,
	name TEXT NULL,
	thumbnail_url VARCHAR(512) NULL,
	checked_at DATETIME NULL,
	created_at DATETIME NOT NULL,
	UNIQUE KEY unique_bot_creators_account (platform, account_id),
	KEY idx_bot_creators_bot_id (bot_id),
	CONSTRAINT fk_bot_creators_bot_id FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_creator_contents (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	creator_id INT NOT NULL,
	content_id VARCHAR(64) NOT NULL,
	type ENUM('video', 'live', 'post') NOT NULL,
	title TEXT NULL,
	url VARCHAR(512) NULL,
	thumbnail_url VARCHAR(512) NULL,
	published_at DATETIME NULL,
	created_at DATETIME NOT NULL,
	UNIQUE KEY unique_bot_creator_contents (creator_id, content_id),
	KEY idx_bot_creator_contents_created_at (created_at),
	CONSTRAINT fk_bot_creator_contents_creator_id FOREIGN KEY (creator_id) REFERENCES bot_creators (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_creator_contents (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	server_id INT NOT NULL,
	content_id INT NOT NULL,
	message_posted_at DATETIME NULL,
	UNIQUE KEY unique_server_creator_contents (server_id, content_id),
	KEY idx_server_creator_contents_server_id (server_id),
	CONSTRAINT fk_server_creator_contents_server_id FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE,
	CONSTRAINT fk_server_creator_contents_content_id FOREIGN KEY (content_id) REFERENCES bot_creator_contents (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_creator_notifications (
	id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	member_id INT NOT NULL,
	creator_id INT NOT NULL,
	types VARCHAR(191) NOT NULL DEFAULT 'video,live,post',
	created_at DATETIME NOT NULL,
	UNIQUE KEY unique_member_creator_notification (member_id, creator_id),
	KEY idx_server_member_creator_notifications_creator (creator_id),
	CONSTRAINT fk_server_member_creator_notifications_member_id FOREIGN KEY (member_id) REFERENCES server_members (id) ON DELETE CASCADE,
	CONSTRAINT fk_server_member_creator_notifications_creator_id FOREIGN KEY (creator_id) REFERENCES bot_creators (id) ON DELETE CASCADE
);

INSERT INTO server_settings (server_id, component_name, settings, created_at, updated_at)
SELECT s.id, 'creator_alerts', CAST('{"enabled": true}' AS JSON), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM servers s
WHERE NOT EXISTS (
	SELECT 1 FROM server_settings ss WHERE ss.server_id = s.id AND ss.component_name = 'creator_alerts'
);
