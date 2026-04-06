SET @has_bot_id := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'bot_id'
);
SET @sql_add_col := IF(
	@has_bot_id = 0,
	'ALTER TABLE servers ADD COLUMN bot_id INT NULL AFTER id',
	'SELECT 1'
);
PREPARE stmt_add_col FROM @sql_add_col;
EXECUTE stmt_add_col;
DEALLOCATE PREPARE stmt_add_col;

UPDATE servers
SET bot_id = official_bot_id
WHERE bot_id IS NULL AND official_bot_id IS NOT NULL;

SET @fk_servers_bot_id := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'bot_id'
	  AND REFERENCED_TABLE_NAME = 'bots'
	LIMIT 1
);
SET @sql_drop_fk_servers_bot_id := IF(
	@fk_servers_bot_id IS NULL,
	'SELECT 1',
	CONCAT('ALTER TABLE servers DROP FOREIGN KEY ', @fk_servers_bot_id)
);
PREPARE stmt_drop_fk_servers_bot_id FROM @sql_drop_fk_servers_bot_id;
EXECUTE stmt_drop_fk_servers_bot_id;
DEALLOCATE PREPARE stmt_drop_fk_servers_bot_id;

SET @fk_servers_bot_id_after := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'bot_id'
	  AND REFERENCED_TABLE_NAME = 'bots'
	LIMIT 1
);
SET @sql_add_fk_servers_bot_id := IF(
	@fk_servers_bot_id_after IS NULL,
	'ALTER TABLE servers ADD CONSTRAINT fk_servers_bot_id FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE',
	'SELECT 1'
);
PREPARE stmt_add_fk_servers_bot_id FROM @sql_add_fk_servers_bot_id;
EXECUTE stmt_add_fk_servers_bot_id;
DEALLOCATE PREPARE stmt_add_fk_servers_bot_id;

SET @has_idx := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'idx_servers_bot_id'
);
SET @sql_add_idx := IF(
	@has_idx = 0,
	'ALTER TABLE servers ADD INDEX idx_servers_bot_id (bot_id)',
	'SELECT 1'
);
PREPARE stmt_add_idx FROM @sql_add_idx;
EXECUTE stmt_add_idx;
DEALLOCATE PREPARE stmt_add_idx;

CREATE TABLE IF NOT EXISTS server_bot_servers (
	id INT PRIMARY KEY AUTO_INCREMENT,
	server_bot_id INT NOT NULL,
	discord_server_id VARCHAR(150) NOT NULL,
	name TEXT,
	total_members INT DEFAULT 0,
	total_channels INT DEFAULT 0,
	server_icon TEXT,
	discord_created_at DATETIME NULL,
	vanity_url_code VARCHAR(255) NULL,
	invite_code VARCHAR(255) NULL,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY uq_server_bot_server (server_bot_id, discord_server_id),
	INDEX idx_server_bot_servers_bot_id (server_bot_id),
	INDEX idx_server_bot_servers_discord_id (discord_server_id),
	FOREIGN KEY (server_bot_id) REFERENCES server_bots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_bot_server_categories (
	id INT PRIMARY KEY AUTO_INCREMENT,
	server_bot_server_id INT NOT NULL,
	discord_category_id VARCHAR(150) NOT NULL,
	name TEXT,
	position INT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY uq_server_bot_category (server_bot_server_id, discord_category_id),
	INDEX idx_server_bot_server_categories_server_id (server_bot_server_id),
	INDEX idx_server_bot_server_categories_discord_id (discord_category_id),
	FOREIGN KEY (server_bot_server_id) REFERENCES server_bot_servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_bot_server_channels (
	id INT PRIMARY KEY AUTO_INCREMENT,
	server_bot_server_id INT NOT NULL,
	discord_channel_id VARCHAR(150) NOT NULL,
	name TEXT,
	type TEXT,
	discord_parent_category_id VARCHAR(150) NULL,
	position INT,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	UNIQUE KEY uq_server_bot_channel (server_bot_server_id, discord_channel_id),
	INDEX idx_server_bot_server_channels_server_id (server_bot_server_id),
	INDEX idx_server_bot_server_channels_discord_id (discord_channel_id),
	INDEX idx_server_bot_server_channels_parent_discord (discord_parent_category_id),
	FOREIGN KEY (server_bot_server_id) REFERENCES server_bot_servers(id) ON DELETE CASCADE
);

SET @fk_official := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'official_bot_id'
	  AND REFERENCED_TABLE_NAME = 'bots'
	LIMIT 1
);
SET @sql_drop_fk_official := IF(
	@fk_official IS NULL,
	'SELECT 1',
	CONCAT('ALTER TABLE servers DROP FOREIGN KEY ', @fk_official)
);
PREPARE stmt_drop_fk_official FROM @sql_drop_fk_official;
EXECUTE stmt_drop_fk_official;
DEALLOCATE PREPARE stmt_drop_fk_official;

SET @has_idx_official_list := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'idx_servers_official_list'
);
SET @sql_drop_idx_official_list := IF(
	@has_idx_official_list = 0,
	'SELECT 1',
	'DROP INDEX idx_servers_official_list ON servers'
);
PREPARE stmt_drop_idx_official_list FROM @sql_drop_idx_official_list;
EXECUTE stmt_drop_idx_official_list;
DEALLOCATE PREPARE stmt_drop_idx_official_list;

SET @has_idx_official_discord := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'idx_servers_official_discord'
);
SET @sql_drop_idx_official_discord := IF(
	@has_idx_official_discord = 0,
	'SELECT 1',
	'DROP INDEX idx_servers_official_discord ON servers'
);
PREPARE stmt_drop_idx_official_discord FROM @sql_drop_idx_official_discord;
EXECUTE stmt_drop_idx_official_discord;
DEALLOCATE PREPARE stmt_drop_idx_official_discord;

-- MySQL 8 functional indexes (expression indexes) can still depend on official_bot_id.
-- Ensure we drop ANY remaining index (including functional) referencing official_bot_id
-- before dropping the column.
SET @sql_drop_any_official_indexes := (
	SELECT NULLIF(
		GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '` ON servers') SEPARATOR '; '),
		''
	)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME <> 'PRIMARY'
	  AND (
		COLUMN_NAME = 'official_bot_id'
		OR (EXPRESSION IS NOT NULL AND EXPRESSION LIKE '%official_bot_id%')
	  )
);
SET @sql_drop_any_official_indexes := IF(@sql_drop_any_official_indexes IS NULL, 'SELECT 1', @sql_drop_any_official_indexes);
PREPARE stmt_drop_any_official_indexes FROM @sql_drop_any_official_indexes;
EXECUTE stmt_drop_any_official_indexes;
DEALLOCATE PREPARE stmt_drop_any_official_indexes;

SET @has_official_col := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'official_bot_id'
);
SET @sql_drop_official_col := IF(
	@has_official_col = 0,
	'SELECT 1',
	'ALTER TABLE servers DROP COLUMN official_bot_id'
);
PREPARE stmt_drop_official_col FROM @sql_drop_official_col;
EXECUTE stmt_drop_official_col;
DEALLOCATE PREPARE stmt_drop_official_col;

SET @fk_selfbot := (
	SELECT CONSTRAINT_NAME
	FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'selfbot_id'
	  AND REFERENCED_TABLE_NAME = 'server_bots'
	LIMIT 1
);
SET @sql_drop_fk_selfbot := IF(
	@fk_selfbot IS NULL,
	'SELECT 1',
	CONCAT('ALTER TABLE servers DROP FOREIGN KEY ', @fk_selfbot)
);
PREPARE stmt_drop_fk_selfbot FROM @sql_drop_fk_selfbot;
EXECUTE stmt_drop_fk_selfbot;
DEALLOCATE PREPARE stmt_drop_fk_selfbot;

SET @has_idx_selfbot_discord := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'idx_servers_selfbot_discord'
);
SET @sql_drop_idx_selfbot_discord := IF(
	@has_idx_selfbot_discord = 0,
	'SELECT 1',
	'DROP INDEX idx_servers_selfbot_discord ON servers'
);
PREPARE stmt_drop_idx_selfbot_discord FROM @sql_drop_idx_selfbot_discord;
EXECUTE stmt_drop_idx_selfbot_discord;
DEALLOCATE PREPARE stmt_drop_idx_selfbot_discord;

SET @has_uq_scope := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'uq_servers_scope'
);
SET @sql_drop_uq_scope := IF(
	@has_uq_scope = 0,
	'SELECT 1',
	'ALTER TABLE servers DROP INDEX uq_servers_scope'
);
PREPARE stmt_drop_uq_scope FROM @sql_drop_uq_scope;
EXECUTE stmt_drop_uq_scope;
DEALLOCATE PREPARE stmt_drop_uq_scope;

SET @has_selfbot_col := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.COLUMNS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND COLUMN_NAME = 'selfbot_id'
);
SET @sql_drop_selfbot_col := IF(
	@has_selfbot_col = 0,
	'SELECT 1',
	'ALTER TABLE servers DROP COLUMN selfbot_id'
);
PREPARE stmt_drop_selfbot_col FROM @sql_drop_selfbot_col;
EXECUTE stmt_drop_selfbot_col;
DEALLOCATE PREPARE stmt_drop_selfbot_col;

SET @has_uq_bot_discord := (
	SELECT COUNT(*)
	FROM INFORMATION_SCHEMA.STATISTICS
	WHERE TABLE_SCHEMA = DATABASE()
	  AND TABLE_NAME = 'servers'
	  AND INDEX_NAME = 'uq_servers_bot_discord'
);
SET @sql_add_uq_bot_discord := IF(
	@has_uq_bot_discord = 0,
	'ALTER TABLE servers ADD UNIQUE KEY uq_servers_bot_discord (bot_id, discord_server_id)',
	'SELECT 1'
);
PREPARE stmt_add_uq_bot_discord FROM @sql_add_uq_bot_discord;
EXECUTE stmt_add_uq_bot_discord;
DEALLOCATE PREPARE stmt_add_uq_bot_discord;

