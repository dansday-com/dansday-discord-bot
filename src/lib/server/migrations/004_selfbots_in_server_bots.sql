-- Add selfbot columns to server_bots (conditional)
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='name');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN name TEXT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='token');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN token TEXT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='status');
SET @s = IF(@col=0,"ALTER TABLE server_bots ADD COLUMN status ENUM('running','stopped','starting','stopping') DEFAULT 'stopped'",'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='process_id');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN process_id INT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='is_testing');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN is_testing BOOLEAN DEFAULT FALSE','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='uptime_started_at');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN uptime_started_at DATETIME NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='updated_at');
SET @s = IF(@col=0,'ALTER TABLE server_bots ADD COLUMN updated_at DATETIME NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Migrate data from bots into server_bots (only if selfbot_id column still exists)
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='selfbot_id');
SET @s = IF(@col>0,'UPDATE server_bots sb JOIN bots b ON b.id = sb.selfbot_id SET sb.name = b.name, sb.token = b.token, sb.status = b.status, sb.process_id = b.process_id, sb.is_testing = b.is_testing, sb.uptime_started_at = b.uptime_started_at, sb.updated_at = b.updated_at','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Drop selfbot_id FK and column
SET @fkname = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='selfbot_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @s = IF(@fkname IS NOT NULL, CONCAT('ALTER TABLE server_bots DROP FOREIGN KEY ', @fkname), 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_bots' AND column_name='selfbot_id');
SET @s = IF(@col>0,'ALTER TABLE server_bots DROP COLUMN selfbot_id','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Remove selfbots from bots table and drop bot_type column
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='bots' AND column_name='bot_type');
SET @s = IF(@col>0,"DELETE FROM bots WHERE bot_type = 'selfbot'",'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='bots' AND column_name='bot_type');
SET @s = IF(@col>0,'ALTER TABLE bots DROP COLUMN bot_type','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Drop idx_bots_type index
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='bots' AND index_name='idx_bots_type');
SET @s = IF(@i>0,'DROP INDEX idx_bots_type ON bots','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- server_accounts: drop bot_id FK (by dynamic name), then index, then column
SET @fkname = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE table_schema=DATABASE() AND table_name='server_accounts' AND column_name='bot_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @s = IF(@fkname IS NOT NULL, CONCAT('ALTER TABLE server_accounts DROP FOREIGN KEY ', @fkname), 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='idx_server_accounts_bot_server');
SET @s = IF(@i>0,'DROP INDEX idx_server_accounts_bot_server ON server_accounts','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='unique_email_bot_server');
SET @s = IF(@i>0,'ALTER TABLE server_accounts DROP KEY unique_email_bot_server','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='unique_username_bot_server');
SET @s = IF(@i>0,'ALTER TABLE server_accounts DROP KEY unique_username_bot_server','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_accounts' AND column_name='bot_id');
SET @s = IF(@col>0,'ALTER TABLE server_accounts DROP COLUMN bot_id','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='unique_email_server');
SET @s = IF(@i=0,'ALTER TABLE server_accounts ADD UNIQUE KEY unique_email_server (email, server_id)','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_accounts' AND index_name='unique_username_server');
SET @s = IF(@i=0,'ALTER TABLE server_accounts ADD UNIQUE KEY unique_username_server (username, server_id)','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Add ip_address to server_accounts
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_accounts' AND column_name='ip_address');
SET @s = IF(@col=0,'ALTER TABLE server_accounts ADD COLUMN ip_address TEXT NULL','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- server_account_invites: drop bot_id FK, then index, then column
SET @fkname = (SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND column_name='bot_id' AND REFERENCED_TABLE_NAME IS NOT NULL LIMIT 1);
SET @s = IF(@fkname IS NOT NULL, CONCAT('ALTER TABLE server_account_invites DROP FOREIGN KEY ', @fkname), 'SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND index_name='idx_server_account_invites_bot_server');
SET @s = IF(@i>0,'DROP INDEX idx_server_account_invites_bot_server ON server_account_invites','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='server_account_invites' AND column_name='bot_id');
SET @s = IF(@col>0,'ALTER TABLE server_account_invites DROP COLUMN bot_id','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- Drop is_frozen from accounts (superadmin only, cannot be frozen)
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='accounts' AND column_name='is_frozen');
SET @s = IF(@col>0,'ALTER TABLE accounts DROP COLUMN is_frozen','SELECT 1');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
