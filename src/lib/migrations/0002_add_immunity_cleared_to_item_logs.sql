ALTER TABLE server_member_item_logs
    ADD COLUMN immunity_cleared TINYINT(1) NOT NULL DEFAULT 0 AFTER actor_disguised;
