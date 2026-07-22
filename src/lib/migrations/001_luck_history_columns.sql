ALTER TABLE server_member_item_logs
    ADD COLUMN rate_percent DECIMAL(6,2) NULL AFTER outcome,
    ADD COLUMN luck_percent DECIMAL(6,2) NULL AFTER rate_percent;

ALTER TABLE server_member_minigame_logs
    ADD COLUMN chance DECIMAL(6,2) NULL AFTER outcome,
    ADD COLUMN luck_percent DECIMAL(6,2) NULL AFTER chance;

ALTER TABLE server_member_level_logs
    ADD COLUMN luck_percent INT NULL AFTER friend_percent;
