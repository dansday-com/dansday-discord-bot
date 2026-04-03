-- Per TikTok live session (tied to server_content_creators) + append-only connector event log

CREATE TABLE IF NOT EXISTS server_content_creators_stream (
    id INT PRIMARY KEY AUTO_INCREMENT,
    content_creator_id INT NOT NULL,
    room_id VARCHAR(64) NULL,
    status ENUM('active', 'ended', 'error') NOT NULL DEFAULT 'active',
    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,
    peak_viewers INT NULL,
    total_likes INT NOT NULL DEFAULT 0,
    total_chat_messages INT NOT NULL DEFAULT 0,
    total_gifts INT NOT NULL DEFAULT 0,
    total_follows INT NOT NULL DEFAULT 0,
    total_shares INT NOT NULL DEFAULT 0,
    unique_chatters INT NULL,
    discord_channel_id VARCHAR(32) NULL,
    discord_thread_id VARCHAR(32) NULL,
    error_message TEXT NULL,
    updated_at DATETIME NULL,
    FOREIGN KEY (content_creator_id) REFERENCES server_content_creators(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_content_creators_stream_log (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    stream_id INT NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    occurred_at DATETIME NOT NULL,
    payload JSON NULL,
    FOREIGN KEY (stream_id) REFERENCES server_content_creators_stream(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cc_stream_creator_started ON server_content_creators_stream(content_creator_id, started_at);
CREATE INDEX IF NOT EXISTS idx_cc_stream_status ON server_content_creators_stream(status);
CREATE INDEX IF NOT EXISTS idx_cc_stream_log_stream_time ON server_content_creators_stream_log(stream_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_cc_stream_log_event ON server_content_creators_stream_log(stream_id, event_type);
