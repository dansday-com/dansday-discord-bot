-- Split servers.bot_id into official_bot_id (nullable FK bots) + selfbot_id (FK server_bots).
-- Official rows: selfbot_id NULL, official_bot_id set. Selfbot mirrors: selfbot_id set, official_bot_id NULL.

SET @col_off = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'servers' AND COLUMN_NAME = 'official_bot_id');

SET @s = IF(@col_off > 0, 'SELECT 1 AS skip_007', 'ALTER TABLE servers ADD COLUMN official_bot_id INT NULL, ADD COLUMN selfbot_id INT NULL');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @col_off2 = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'servers' AND COLUMN_NAME = 'official_bot_id');
SET @col_bot = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'servers' AND COLUMN_NAME = 'bot_id');

SET @s = IF(@col_off2 > 0 AND @col_bot > 0,
  'UPDATE servers s SET s.official_bot_id = s.bot_id, s.selfbot_id = NULL WHERE s.bot_id IN (SELECT id FROM bots)',
  'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @s = IF(@col_off2 > 0 AND @col_bot > 0,
  'UPDATE servers s INNER JOIN server_bots sb ON sb.id = s.bot_id SET s.selfbot_id = s.bot_id, s.official_bot_id = NULL WHERE s.official_bot_id IS NULL',
  'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @fkname = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'servers' AND COLUMN_NAME = 'bot_id' AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@fkname IS NOT NULL, CONCAT('ALTER TABLE servers DROP FOREIGN KEY `', @fkname, '`'), 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'servers' AND index_name = 'unique_bot_server');
SET @s = IF(@i > 0, 'ALTER TABLE servers DROP INDEX unique_bot_server', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'servers' AND index_name = 'idx_servers_bot_id');
SET @s = IF(@i > 0, 'ALTER TABLE servers DROP INDEX idx_servers_bot_id', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @bad_official = (SELECT COUNT(*) FROM servers WHERE selfbot_id IS NULL AND official_bot_id IS NULL);
SET @s = IF(@col_bot > 0 AND @bad_official = 0, 'ALTER TABLE servers DROP COLUMN bot_id', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'servers' AND index_name = 'uq_servers_official_discord_selfbot');
SET @s = IF(@i > 0, 'ALTER TABLE servers DROP INDEX uq_servers_official_discord_selfbot', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @i2 = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'servers' AND index_name = 'uq_servers_scope');
SET @s = IF(@i2 = 0 AND @col_off2 > 0, 'CREATE UNIQUE INDEX uq_servers_scope ON servers (discord_server_id, (IFNULL(selfbot_id, 0)), (IFNULL(official_bot_id, 0)))', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @fk_off = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'servers' AND COLUMN_NAME = 'official_bot_id' AND REFERENCED_TABLE_NAME = 'bots'
  LIMIT 1
);
SET @s = IF(@fk_off IS NULL AND @col_off2 > 0, 'ALTER TABLE servers ADD CONSTRAINT fk_servers_official_bot FOREIGN KEY (official_bot_id) REFERENCES bots(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @fk_sb = (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'servers' AND COLUMN_NAME = 'selfbot_id' AND REFERENCED_TABLE_NAME = 'server_bots'
  LIMIT 1
);
SET @s = IF(@fk_sb IS NULL AND @col_off2 > 0, 'ALTER TABLE servers ADD CONSTRAINT fk_servers_selfbot FOREIGN KEY (selfbot_id) REFERENCES server_bots(id) ON DELETE CASCADE', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;
