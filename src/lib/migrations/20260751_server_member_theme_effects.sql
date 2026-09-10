ALTER TABLE server_member_themes ADD COLUMN effect VARCHAR(32) NOT NULL DEFAULT 'none';
ALTER TABLE server_member_themes ADD COLUMN effect_seed INT NOT NULL DEFAULT 0;
ALTER TABLE server_member_themes ADD COLUMN effect_enabled BOOLEAN NOT NULL DEFAULT TRUE;
