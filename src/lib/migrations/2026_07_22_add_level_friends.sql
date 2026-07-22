CREATE TABLE IF NOT EXISTS server_member_level_friends (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_a_id INT NOT NULL,
    member_b_id INT NOT NULL,
    ticks INT NOT NULL DEFAULT 0,
    xp_together BIGINT NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (member_a_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (member_b_id) REFERENCES server_members(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_level_friends_pair (member_a_id, member_b_id)
);

DROP PROCEDURE IF EXISTS _add_idx_level_friends;
CREATE PROCEDURE _add_idx_level_friends()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_level_friends' AND index_name = 'idx_level_friends_a') THEN
        CREATE INDEX idx_level_friends_a ON server_member_level_friends(member_a_id, ticks);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_level_friends' AND index_name = 'idx_level_friends_b') THEN
        CREATE INDEX idx_level_friends_b ON server_member_level_friends(member_b_id, ticks);
    END IF;
END;
CALL _add_idx_level_friends();
DROP PROCEDURE IF EXISTS _add_idx_level_friends;
