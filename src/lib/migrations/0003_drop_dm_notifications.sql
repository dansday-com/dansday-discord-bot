DROP PROCEDURE IF EXISTS drop_dm_notifications_col;

CREATE PROCEDURE drop_dm_notifications_col()
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'server_member_levels'
          AND COLUMN_NAME = 'dm_notifications_enabled'
    ) THEN
        ALTER TABLE server_member_levels DROP COLUMN dm_notifications_enabled;
    END IF;
END;

CALL drop_dm_notifications_col();

DROP PROCEDURE IF EXISTS drop_dm_notifications_col;
