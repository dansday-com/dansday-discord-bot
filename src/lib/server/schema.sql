CREATE TABLE IF NOT EXISTS migrations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL UNIQUE,
    ran_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS panel (
    id INT PRIMARY KEY AUTO_INCREMENT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    account_type ENUM('superadmin') NOT NULL DEFAULT 'superadmin',
    email_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(6) NULL,
    otp_expires_at DATETIME NULL,
    panel_id INT NULL,
    ip_address TEXT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (panel_id) REFERENCES panel(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name TEXT NOT NULL,
    token TEXT NOT NULL,
    application_id TEXT,
    bot_icon TEXT,
    port INT,
    secret_key TEXT,
    account_id INT NULL,
    is_testing BOOLEAN DEFAULT FALSE,
    status ENUM('running', 'stopped', 'starting', 'stopping') DEFAULT 'stopped',
    process_id INT,
    uptime_started_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS servers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    bot_id INT NOT NULL,
    discord_server_id VARCHAR(150) NOT NULL,
    name TEXT,
    total_members INT DEFAULT 0,
    total_channels INT DEFAULT 0,
    total_boosters INT DEFAULT 0,
    boost_level INT DEFAULT 0,
    server_icon TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_bot_server (bot_id, discord_server_id),
    FOREIGN KEY (bot_id) REFERENCES bots(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_accounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    username VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    account_type ENUM('owner', 'moderator') NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(6) NULL,
    otp_expires_at DATETIME NULL,
    ip_address TEXT NULL,
    is_frozen BOOLEAN DEFAULT FALSE,
    invited_by INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_email_server (email, server_id),
    UNIQUE KEY unique_username_server (username, server_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (invited_by) REFERENCES server_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_account_invites (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token VARCHAR(255) NOT NULL UNIQUE,
    server_id INT NOT NULL,
    account_type ENUM('owner', 'moderator') NOT NULL,
    created_by INT NOT NULL,
    used_by INT NULL,
    expires_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    used_at DATETIME NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES server_accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_bots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    name TEXT NULL,
    token TEXT NULL,
    status ENUM('running','stopped','starting','stopping') DEFAULT 'stopped',
    process_id INT NULL,
    is_testing BOOLEAN DEFAULT FALSE,
    uptime_started_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NULL,
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    discord_category_id VARCHAR(150) NOT NULL,
    name TEXT,
    position INT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_category (server_id, discord_category_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    discord_role_id VARCHAR(150) NOT NULL,
    name TEXT,
    position INT,
    color TEXT,
    permissions TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_role (server_id, discord_role_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_channels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    discord_channel_id VARCHAR(150) NOT NULL,
    name TEXT,
    type TEXT,
    category_id INT NULL,
    position INT,
    notification_role_id INT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_channel (server_id, discord_channel_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES server_categories(id) ON DELETE SET NULL,
    FOREIGN KEY (notification_role_id) REFERENCES server_roles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS server_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    discord_member_id VARCHAR(150) NOT NULL,
    username TEXT,
    display_name TEXT,
    server_display_name TEXT,
    avatar TEXT,
    profile_created_at DATETIME NULL,
    member_since DATETIME NULL,
    is_booster BOOLEAN DEFAULT FALSE,
    booster_since DATETIME NULL,
    language VARCHAR(10) DEFAULT 'en',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_member (server_id, discord_member_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_levels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    chat_total INT DEFAULT 0,
    voice_minutes_total INT DEFAULT 0,
    voice_minutes_active INT DEFAULT 0,
    voice_minutes_afk INT DEFAULT 0,
    experience INT DEFAULT 0,
    level INT DEFAULT 1,
    dm_notifications_enabled BOOLEAN DEFAULT TRUE,
    is_in_voice BOOLEAN DEFAULT FALSE,
    `rank` INT DEFAULT NULL,
    chat_rewarded_at DATETIME NULL,
    voice_rewarded_at DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_level (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_member_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    role_id INT NOT NULL,
    is_custom BOOLEAN DEFAULT FALSE,
    is_rating BOOLEAN DEFAULT FALSE,
    is_notification BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_role (member_id, role_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_members_afk (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    message TEXT,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_afk (member_id),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    server_id INT NOT NULL,
    component_name VARCHAR(150) NOT NULL,
    settings JSON NOT NULL DEFAULT ('{}'),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_server_component (server_id, component_name),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_giveaways (
    id INT PRIMARY KEY AUTO_INCREMENT,
    discord_message_id VARCHAR(150) NULL,
    member_id INT NOT NULL,
    title TEXT NOT NULL,
    prize TEXT NOT NULL,
    duration_minutes INT NOT NULL,
    allowed_roles JSON NULL,
    multiple_entries_allowed BOOLEAN DEFAULT FALSE,
    winner_count INT NOT NULL DEFAULT 1,
    status ENUM('active', 'ended', 'ended_force') DEFAULT 'active',
    ends_at DATETIME NOT NULL,
    winners_announced BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_giveaway_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    giveaway_id INT NOT NULL,
    member_id INT NOT NULL,
    entry_count INT DEFAULT 1,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_giveaway_member (giveaway_id, member_id),
    FOREIGN KEY (giveaway_id) REFERENCES server_giveaways(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_staff_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    staff_member_id INT NOT NULL,
    current_rating DECIMAL(3,2) DEFAULT 0,
    total_reports INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY unique_staff_rating (staff_member_id),
    FOREIGN KEY (staff_member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_staff_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    reporter_member_id INT NOT NULL,
    reported_staff_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK(rating >= 1 AND rating <= 5),
    category VARCHAR(50) NOT NULL,
    description TEXT,
    is_anonymous BOOLEAN DEFAULT 0,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reported_at DATETIME NOT NULL,
    FOREIGN KEY (reporter_member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (reported_staff_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS server_feedback (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    description TEXT NOT NULL,
    is_anonymous BOOLEAN DEFAULT 0,
    submitted_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bots_account_id ON bots(account_id);
CREATE INDEX IF NOT EXISTS idx_servers_bot_id ON servers(bot_id);
CREATE INDEX IF NOT EXISTS idx_servers_discord_id ON servers(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_server_categories_server_id ON server_categories(server_id);
CREATE INDEX IF NOT EXISTS idx_server_categories_discord_id ON server_categories(discord_category_id);
CREATE INDEX IF NOT EXISTS idx_server_channels_server_id ON server_channels(server_id);
CREATE INDEX IF NOT EXISTS idx_server_channels_discord_id ON server_channels(discord_channel_id);
CREATE INDEX IF NOT EXISTS idx_server_channels_category_id ON server_channels(category_id);
CREATE INDEX IF NOT EXISTS idx_server_roles_server_id ON server_roles(server_id);
CREATE INDEX IF NOT EXISTS idx_server_roles_discord_id ON server_roles(discord_role_id);
CREATE INDEX IF NOT EXISTS idx_server_members_server_id ON server_members(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_discord_id ON server_members(discord_member_id);
CREATE INDEX IF NOT EXISTS idx_server_members_language ON server_members(language);
CREATE INDEX IF NOT EXISTS idx_server_member_levels_member_id ON server_member_levels(member_id);
CREATE INDEX IF NOT EXISTS idx_server_member_levels_rank ON server_member_levels(`rank`);
CREATE INDEX IF NOT EXISTS idx_server_member_roles_member_id ON server_member_roles(member_id);
CREATE INDEX IF NOT EXISTS idx_server_member_roles_role_id ON server_member_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_server_members_afk_member_id ON server_members_afk(member_id);
CREATE INDEX IF NOT EXISTS idx_server_settings_server_id ON server_settings(server_id);
CREATE INDEX IF NOT EXISTS idx_server_settings_component ON server_settings(server_id, component_name);
CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);
CREATE INDEX IF NOT EXISTS idx_accounts_username ON accounts(username);
CREATE INDEX IF NOT EXISTS idx_accounts_panel_id ON accounts(panel_id);
CREATE INDEX IF NOT EXISTS idx_server_accounts_server_id ON server_accounts(server_id);
CREATE INDEX IF NOT EXISTS idx_server_accounts_email ON server_accounts(email);
CREATE INDEX IF NOT EXISTS idx_server_account_invites_token ON server_account_invites(token);
CREATE INDEX IF NOT EXISTS idx_server_account_invites_server_id ON server_account_invites(server_id);
CREATE INDEX IF NOT EXISTS idx_server_bots_server_id ON server_bots(server_id);
CREATE INDEX IF NOT EXISTS idx_server_giveaways_member_id ON server_giveaways(member_id);
CREATE INDEX IF NOT EXISTS idx_server_giveaways_status ON server_giveaways(status);
CREATE INDEX IF NOT EXISTS idx_server_giveaways_ends_at ON server_giveaways(ends_at);
CREATE INDEX IF NOT EXISTS idx_server_giveaway_entries_giveaway_id ON server_giveaway_entries(giveaway_id);
CREATE INDEX IF NOT EXISTS idx_server_giveaway_entries_member_id ON server_giveaway_entries(member_id);
CREATE INDEX IF NOT EXISTS idx_server_staff_ratings_member ON server_staff_ratings(staff_member_id);
CREATE INDEX IF NOT EXISTS idx_server_staff_reports_staff ON server_staff_reports(reported_staff_id);
CREATE INDEX IF NOT EXISTS idx_server_staff_reports_pair ON server_staff_reports(reporter_member_id, reported_staff_id);
CREATE INDEX IF NOT EXISTS idx_server_staff_reports_status ON server_staff_reports(status);
CREATE INDEX IF NOT EXISTS idx_server_feedback_member ON server_feedback(member_id);
