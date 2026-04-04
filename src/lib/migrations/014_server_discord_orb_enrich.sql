ALTER TABLE server_discord_orb
	ADD COLUMN quest_name TEXT NULL AFTER quest_task_label,
	ADD COLUMN game_title TEXT NULL AFTER quest_name,
	ADD COLUMN game_subtitle TEXT NULL AFTER game_title,
	ADD COLUMN publisher VARCHAR(255) NULL AFTER game_subtitle,
	ADD COLUMN quest_url VARCHAR(512) NULL AFTER publisher,
	ADD COLUMN quest_description TEXT NULL AFTER quest_url,
	ADD COLUMN orb_hint TEXT NULL AFTER quest_description,
	ADD COLUMN rewards_line TEXT NULL AFTER orb_hint,
	ADD COLUMN task_detail_line TEXT NULL AFTER rewards_line,
	ADD COLUMN thumbnail_url VARCHAR(2048) NULL AFTER task_detail_line,
	ADD COLUMN banner_url VARCHAR(2048) NULL AFTER thumbnail_url,
	ADD COLUMN starts_at DATETIME NULL AFTER banner_url,
	ADD COLUMN expires_at DATETIME NULL AFTER starts_at;
