ALTER TABLE servers ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
ALTER TABLE server_members ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
CREATE INDEX idx_servers_deleted_at ON servers (deleted_at);
CREATE INDEX idx_server_members_deleted_at ON server_members (deleted_at);
