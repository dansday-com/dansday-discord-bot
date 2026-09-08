ALTER TABLE server_members ADD COLUMN is_bot BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX idx_server_members_is_bot ON server_members (server_id, is_bot);
