-- Migration 006: Add Discord server metadata fields
-- Adds servers.discord_created_at, servers.vanity_url_code, servers.invite_code for richer UI cards + links.
-- Safe to run multiple times.

-- 1) Add discord_created_at if missing
SET @col_created_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'servers'
      AND column_name = 'discord_created_at'
);
SET @s = IF(@col_created_exists = 0, 'ALTER TABLE servers ADD COLUMN discord_created_at DATETIME NULL AFTER server_icon', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Add vanity_url_code if missing
SET @col_vanity_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'servers'
      AND column_name = 'vanity_url_code'
);
SET @s = IF(@col_vanity_exists = 0, 'ALTER TABLE servers ADD COLUMN vanity_url_code VARCHAR(255) NULL AFTER discord_created_at', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Add invite_code if missing (first available invite, best-effort)
SET @col_invite_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'servers'
      AND column_name = 'invite_code'
);
SET @s = IF(@col_invite_exists = 0, 'ALTER TABLE servers ADD COLUMN invite_code VARCHAR(255) NULL AFTER vanity_url_code', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Add indexes (conditional)
SET @i = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'servers'
      AND index_name = 'idx_servers_discord_created_at'
);
SET @s = IF(@i = 0, 'CREATE INDEX idx_servers_discord_created_at ON servers(discord_created_at)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (
    SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'servers'
      AND index_name = 'idx_servers_invite_code'
);
SET @s = IF(@i = 0, 'CREATE INDEX idx_servers_invite_code ON servers(invite_code)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

