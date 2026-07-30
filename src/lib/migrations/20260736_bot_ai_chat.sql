CREATE TABLE IF NOT EXISTS bot_ai (
	id INT AUTO_INCREMENT PRIMARY KEY,
	bot_id INT NOT NULL,
	enabled TINYINT(1) NOT NULL DEFAULT 0,
	api_url TEXT NULL,
	api_key TEXT NULL,
	model VARCHAR(191) NULL,
	system_prompt TEXT NULL,
	reasoning ENUM('none', 'low', 'medium', 'high', 'xhigh') NOT NULL DEFAULT 'none',
	voice_enabled TINYINT(1) NOT NULL DEFAULT 0,
	voice_model VARCHAR(191) NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY uq_bot_ai_bot_id (bot_id),
	CONSTRAINT fk_bot_ai_bot FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bot_ai_messages (
	id INT AUTO_INCREMENT PRIMARY KEY,
	bot_id INT NOT NULL,
	guild_discord_id VARCHAR(32) NOT NULL,
	member_discord_id VARCHAR(32) NOT NULL,
	role ENUM('user', 'assistant') NOT NULL,
	content TEXT NOT NULL,
	created_at DATETIME NOT NULL,
	KEY idx_bot_ai_messages_session (bot_id, guild_discord_id, member_discord_id, id),
	CONSTRAINT fk_bot_ai_messages_bot FOREIGN KEY (bot_id) REFERENCES bots (id) ON DELETE CASCADE
);
