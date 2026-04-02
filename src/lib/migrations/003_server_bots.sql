CREATE TABLE IF NOT EXISTS server_bots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    selfbot_id INT NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_selfbot (server_id, selfbot_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (selfbot_id) REFERENCES bots(id) ON DELETE CASCADE
);

INSERT IGNORE INTO server_bots (server_id, selfbot_id, created_at)
SELECT server_id, selfbot_id, created_at FROM server_selfbot_assignments;

DROP TABLE IF EXISTS server_selfbot_assignments;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_bots' AND index_name='idx_server_bots_server_id');
SET @s = IF(@i=0,'CREATE INDEX idx_server_bots_server_id ON server_bots(server_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_bots' AND index_name='idx_server_bots_selfbot_id');
SET @s = IF(@i=0,'CREATE INDEX idx_server_bots_selfbot_id ON server_bots(selfbot_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;
