CREATE TABLE IF NOT EXISTS server_rewards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    goal_type VARCHAR(16) NOT NULL DEFAULT 'level',
    goal INT NOT NULL,
    kind VARCHAR(8) NOT NULL DEFAULT 'role',
    role_id INT NULL,
    xp INT NOT NULL DEFAULT 0,
    name VARCHAR(64) NULL,
    image VARCHAR(255) NULL,
    winner_limit INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE SET NULL,
    INDEX idx_server_rewards_server (server_id, goal_type, goal)
);

CREATE TABLE IF NOT EXISTS server_member_rewards (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    reward_id INT NOT NULL,
    delivered_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES server_rewards(id) ON DELETE CASCADE,
    UNIQUE KEY unique_server_member_reward (member_id, reward_id),
    INDEX idx_server_member_rewards_reward (reward_id)
);

INSERT INTO server_rewards (server_id, goal_type, goal, kind, role_id, created_at, updated_at)
SELECT s.server_id, 'level', CAST(JSON_EXTRACT(s.settings, CONCAT('$.rewards[', n.i, '].level')) AS SIGNED), 'role', sr.id, UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM server_settings s
INNER JOIN (
    SELECT 0 AS i UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4
    UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9
    UNION ALL SELECT 10 UNION ALL SELECT 11 UNION ALL SELECT 12 UNION ALL SELECT 13 UNION ALL SELECT 14
    UNION ALL SELECT 15 UNION ALL SELECT 16 UNION ALL SELECT 17 UNION ALL SELECT 18 UNION ALL SELECT 19
    UNION ALL SELECT 20 UNION ALL SELECT 21 UNION ALL SELECT 22 UNION ALL SELECT 23 UNION ALL SELECT 24
) n ON n.i < JSON_LENGTH(s.settings, '$.rewards')
INNER JOIN server_roles sr
    ON sr.server_id = s.server_id
    AND sr.discord_role_id = JSON_UNQUOTE(JSON_EXTRACT(s.settings, CONCAT('$.rewards[', n.i, '].role_id')))
WHERE s.component_name = 'main'
  AND JSON_EXTRACT(s.settings, CONCAT('$.rewards[', n.i, '].level')) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM server_rewards existing WHERE existing.server_id = s.server_id);

UPDATE server_settings
SET settings = JSON_REMOVE(settings, '$.rewards')
WHERE component_name = 'main' AND JSON_CONTAINS_PATH(settings, 'one', '$.rewards');
