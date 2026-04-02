ALTER TABLE server_bots
    ADD COLUMN name TEXT NULL,
    ADD COLUMN token TEXT NULL,
    ADD COLUMN status ENUM('running','stopped','starting','stopping') DEFAULT 'stopped',
    ADD COLUMN process_id INT NULL,
    ADD COLUMN is_testing BOOLEAN DEFAULT FALSE,
    ADD COLUMN uptime_started_at DATETIME NULL,
    ADD COLUMN updated_at DATETIME NULL;

UPDATE server_bots sb
JOIN bots b ON b.id = sb.selfbot_id
SET sb.name = b.name,
    sb.token = b.token,
    sb.status = b.status,
    sb.process_id = b.process_id,
    sb.is_testing = b.is_testing,
    sb.uptime_started_at = b.uptime_started_at,
    sb.updated_at = b.updated_at;

ALTER TABLE server_bots DROP FOREIGN KEY server_bots_ibfk_2;
ALTER TABLE server_bots DROP COLUMN selfbot_id;

DELETE FROM bots WHERE bot_type = 'selfbot';

ALTER TABLE bots DROP COLUMN bot_type;

ALTER TABLE server_accounts
    DROP FOREIGN KEY server_accounts_ibfk_1;

ALTER TABLE server_accounts
    DROP COLUMN bot_id,
    DROP KEY unique_email_bot_server,
    DROP KEY unique_username_bot_server,
    ADD UNIQUE KEY unique_email_server (email, server_id),
    ADD UNIQUE KEY unique_username_server (username, server_id);

ALTER TABLE server_account_invites
    DROP FOREIGN KEY server_account_invites_ibfk_1;

ALTER TABLE server_account_invites
    DROP COLUMN bot_id;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='idx_server_accounts_bot_server');
SET @s = IF(@i>0,'DROP INDEX idx_server_accounts_bot_server ON server_accounts','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND index_name='idx_server_account_invites_bot_server');
SET @s = IF(@i>0,'DROP INDEX idx_server_account_invites_bot_server ON server_account_invites','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='bots' AND index_name='idx_bots_type');
SET @s = IF(@i>0,'DROP INDEX idx_bots_type ON bots','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;
