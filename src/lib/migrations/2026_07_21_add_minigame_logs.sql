CREATE TABLE IF NOT EXISTS server_member_minigame_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    game VARCHAR(24) NOT NULL DEFAULT 'gamble',
    multiplier DECIMAL(6,2) NOT NULL DEFAULT 2,
    wager INT NOT NULL DEFAULT 0,
    payout INT NOT NULL DEFAULT 0,
    xp_amount INT NOT NULL DEFAULT 0,
    outcome VARCHAR(16) NOT NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

DROP PROCEDURE IF EXISTS _add_idx_minigame_logs;
CREATE PROCEDURE _add_idx_minigame_logs()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_minigame_logs' AND index_name = 'idx_server_member_minigame_logs_member') THEN
        CREATE INDEX idx_server_member_minigame_logs_member ON server_member_minigame_logs(member_id, created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_minigame_logs' AND index_name = 'idx_server_member_minigame_logs_created') THEN
        CREATE INDEX idx_server_member_minigame_logs_created ON server_member_minigame_logs(created_at);
    END IF;
END;
CALL _add_idx_minigame_logs();
DROP PROCEDURE IF EXISTS _add_idx_minigame_logs;

INSERT INTO server_member_minigame_logs (member_id, game, multiplier, wager, payout, xp_amount, outcome, created_at)
SELECT
    l.member_id,
    'gamble',
    2,
    CASE WHEN l.outcome = 'win' THEN 0 ELSE ABS(l.xp_amount) END,
    CASE WHEN l.outcome = 'win' THEN l.xp_amount ELSE 0 END,
    l.xp_amount,
    l.outcome,
    l.created_at
FROM server_member_item_logs l
WHERE l.action = 'gamble'
  AND NOT EXISTS (
    SELECT 1 FROM server_member_minigame_logs m
    WHERE m.member_id = l.member_id AND m.created_at = l.created_at AND m.xp_amount = l.xp_amount
  );

DELETE FROM server_member_item_logs WHERE action = 'gamble';
