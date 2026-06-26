ALTER TABLE server_member_item_logs
    ADD COLUMN actor_disguised TINYINT(1) NOT NULL DEFAULT 0 AFTER outcome;
