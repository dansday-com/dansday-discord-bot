SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_bots' AND column_name = 'bot_icon');
SET @s = IF(@col = 0, 'ALTER TABLE server_bots ADD COLUMN bot_icon TEXT NULL', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;
