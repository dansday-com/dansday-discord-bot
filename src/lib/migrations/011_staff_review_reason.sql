-- Optional staff-written reason when approving/rejecting staff reports and content creator applications

SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'server_staff_reports'
      AND column_name = 'review_reason'
);
SET @s = IF(@col_exists=0,'ALTER TABLE server_staff_reports ADD COLUMN review_reason TEXT NULL','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'server_content_creators'
      AND column_name = 'review_reason'
);
SET @s = IF(@col_exists=0,'ALTER TABLE server_content_creators ADD COLUMN review_reason TEXT NULL','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;
