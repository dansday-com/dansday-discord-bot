ALTER TABLE selfbot_server_channels ADD COLUMN viewable BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX idx_selfbot_server_channels_viewable ON selfbot_server_channels (selfbot_server_id, viewable);
