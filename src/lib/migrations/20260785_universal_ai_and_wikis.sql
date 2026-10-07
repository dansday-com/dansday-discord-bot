CREATE TABLE IF NOT EXISTS ai (
    id INT PRIMARY KEY AUTO_INCREMENT,
    panel_id INT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    api_url TEXT NULL,
    api_key TEXT NULL,
    model VARCHAR(191) NULL,
    system_prompt TEXT NULL,
    reasoning ENUM('none', 'low', 'medium', 'high', 'xhigh') NOT NULL DEFAULT 'none',
    voice_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    voice_model VARCHAR(191) NULL,
    voice_name VARCHAR(64) NULL,
    voice_thinking ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
    voice_api_key TEXT NULL,
    voice_system_prompt TEXT NULL,
    search_api_url TEXT NULL,
    search_api_key TEXT NULL,
    search_model VARCHAR(191) NULL,
    fetch_api_url TEXT NULL,
    fetch_api_key TEXT NULL,
    fetch_model VARCHAR(191) NULL,
    image_api_url TEXT NULL,
    image_api_key TEXT NULL,
    image_model VARCHAR(191) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_ai_panel_id (panel_id),
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wikis (
    id INT PRIMARY KEY AUTO_INCREMENT,
    panel_id INT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    name VARCHAR(64) NOT NULL,
    api_url VARCHAR(512) NOT NULL,
    site_url VARCHAR(512) NULL,
    relay_url VARCHAR(512) NULL,
    relay_key VARCHAR(191) NULL,
    description VARCHAR(255) NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    UNIQUE KEY uq_wikis_panel_name (panel_id, name),
    INDEX idx_wikis_panel (panel_id),
    FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE CASCADE
);

SET @move_ai = IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bot_ai') > 0,
    'INSERT IGNORE INTO ai (
        panel_id, enabled, api_url, api_key, model, system_prompt, reasoning,
        voice_enabled, voice_model, voice_name, voice_thinking, voice_api_key, voice_system_prompt,
        search_api_url, search_api_key, search_model,
        fetch_api_url, fetch_api_key, fetch_model,
        image_api_url, image_api_key, image_model,
        created_at, updated_at
    )
    SELECT
        b.panel_id, a.enabled, a.api_url, a.api_key, a.model, a.system_prompt, a.reasoning,
        a.voice_enabled, a.voice_model, a.voice_name, a.voice_thinking, a.voice_api_key, a.voice_system_prompt,
        a.search_api_url, a.search_api_key, a.search_model,
        a.fetch_api_url, a.fetch_api_key, a.fetch_model,
        a.image_api_url, a.image_api_key, a.image_model,
        a.created_at, a.updated_at
    FROM bot_ai a
    INNER JOIN bots b ON b.id = a.bot_id
    WHERE a.id = (
        SELECT a2.id
        FROM bot_ai a2
        INNER JOIN bots b2 ON b2.id = a2.bot_id
        WHERE b2.panel_id = b.panel_id
        ORDER BY a2.enabled DESC, a2.updated_at DESC, a2.id DESC
        LIMIT 1
    )',
    'DO 0'
);
PREPARE move_ai FROM @move_ai;
EXECUTE move_ai;
DEALLOCATE PREPARE move_ai;

SET @move_wikis = IF(
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'bot_wikis') > 0,
    'INSERT IGNORE INTO wikis (panel_id, enabled, name, api_url, site_url, relay_url, relay_key, description, created_at, updated_at)
    SELECT b.panel_id, w.enabled, w.name, w.api_url, w.site_url, w.relay_url, w.relay_key, w.description, w.created_at, w.updated_at
    FROM bot_wikis w
    INNER JOIN bots b ON b.id = w.bot_id
    ORDER BY w.enabled DESC, w.updated_at DESC, w.id DESC',
    'DO 0'
);
PREPARE move_wikis FROM @move_wikis;
EXECUTE move_wikis;
DEALLOCATE PREPARE move_wikis;

DROP TABLE IF EXISTS bot_ai;
DROP TABLE IF EXISTS bot_wikis;
