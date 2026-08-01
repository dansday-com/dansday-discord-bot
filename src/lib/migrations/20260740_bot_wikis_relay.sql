ALTER TABLE bot_wikis ADD COLUMN relay_url VARCHAR(512) NULL AFTER site_url;
ALTER TABLE bot_wikis ADD COLUMN relay_key VARCHAR(191) NULL AFTER relay_url;
