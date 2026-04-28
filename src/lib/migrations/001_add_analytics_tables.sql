CREATE TABLE IF NOT EXISTS server_analytics_daily (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    date DATE NOT NULL,
    members_joined INT DEFAULT 0,
    members_left INT DEFAULT 0,
    members_total INT DEFAULT 0,
    messages_count INT DEFAULT 0,
    voice_sessions INT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    active_members INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_daily (server_id, date),
    INDEX idx_server_analytics_daily_server (server_id),
    INDEX idx_server_analytics_daily_date (date),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_analytics_hourly (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    date_hour DATETIME NOT NULL,
    messages_count INT DEFAULT 0,
    voice_sessions INT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    active_members INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_hourly (server_id, date_hour),
    INDEX idx_server_analytics_hourly_server (server_id),
    INDEX idx_server_analytics_hourly_hour (date_hour),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_analytics_channels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    channel_id INT NOT NULL,
    server_id INT NOT NULL,
    date DATE NOT NULL,
    messages_count INT DEFAULT 0,
    unique_authors INT DEFAULT 0,
    voice_sessions INT DEFAULT 0,
    voice_minutes INT DEFAULT 0,
    health_score DECIMAL(5, 2) DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_channels (channel_id, date),
    INDEX idx_server_analytics_channels_server (server_id),
    INDEX idx_server_analytics_channels_date (date),
    FOREIGN KEY (channel_id) REFERENCES server_channels(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_analytics_member_engagement (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    server_id INT NOT NULL,
    engagement_score DECIMAL(5, 2) DEFAULT 0,
    last_activity_at DATETIME NULL,
    messages_30d INT DEFAULT 0,
    voice_minutes_30d INT DEFAULT 0,
    days_active_30d INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_member_engagement (member_id),
    INDEX idx_server_analytics_member_engagement_server (server_id),
    INDEX idx_server_analytics_member_engagement_score (engagement_score),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_analytics_retention (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    date DATE NOT NULL,
    cohort_date DATE NOT NULL,
    members_in_cohort INT DEFAULT 0,
    members_retained INT DEFAULT 0,
    retention_rate DECIMAL(5, 2) DEFAULT 0,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_retention (server_id, date, cohort_date),
    INDEX idx_server_analytics_retention_server (server_id),
    INDEX idx_server_analytics_retention_date (date),
    INDEX idx_server_analytics_retention_cohort (cohort_date),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_analytics_snapshots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    total_members INT DEFAULT 0,
    members_with_activity INT DEFAULT 0,
    avg_engagement_score DECIMAL(5, 2) DEFAULT 0,
    total_messages_30d INT DEFAULT 0,
    total_voice_minutes_30d INT DEFAULT 0,
    top_channels JSON,
    top_members JSON,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uq_server_analytics_snapshots (server_id, snapshot_date),
    INDEX idx_server_analytics_snapshots_server (server_id),
    INDEX idx_server_analytics_snapshots_date (snapshot_date),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);
