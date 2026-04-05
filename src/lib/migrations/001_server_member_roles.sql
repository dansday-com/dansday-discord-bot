-- Idempotent: table + indexes + FKs (same pattern as conditional PREPARE / information_schema checks).

CREATE TABLE IF NOT EXISTS server_member_roles (
	member_id INT NOT NULL,
	role_id INT NOT NULL,
	created_at DATETIME NOT NULL
) ENGINE=InnoDB;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_roles' AND index_name = 'unique_server_member_role');
SET @s = IF(@i = 0, 'ALTER TABLE server_member_roles ADD UNIQUE KEY unique_server_member_role (member_id, role_id)', 'SELECT 1');
PREPARE si FROM @s;
EXECUTE si;
DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_roles' AND index_name = 'idx_server_member_roles_member');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_roles_member ON server_member_roles (member_id)', 'SELECT 1');
PREPARE si FROM @s;
EXECUTE si;
DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'server_member_roles' AND constraint_name = 'fk_server_member_roles_member' AND constraint_type = 'FOREIGN KEY');
SET @s = IF(@i = 0, 'ALTER TABLE server_member_roles ADD CONSTRAINT fk_server_member_roles_member FOREIGN KEY (member_id) REFERENCES server_members (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE si FROM @s;
EXECUTE si;
DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE table_schema = DATABASE() AND table_name = 'server_member_roles' AND constraint_name = 'fk_server_member_roles_role' AND constraint_type = 'FOREIGN KEY');
SET @s = IF(@i = 0, 'ALTER TABLE server_member_roles ADD CONSTRAINT fk_server_member_roles_role FOREIGN KEY (role_id) REFERENCES server_roles (id) ON DELETE CASCADE', 'SELECT 1');
PREPARE si FROM @s;
EXECUTE si;
DEALLOCATE PREPARE si;
