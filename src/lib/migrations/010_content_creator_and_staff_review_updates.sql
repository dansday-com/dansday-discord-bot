CREATE TABLE IF NOT EXISTS server_content_creators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    tiktok_username VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    reviewed_by_member_id INT NULL,
    reviewed_at DATETIME NULL,
    submitted_at DATETIME NOT NULL,
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL
);

-- Indexes (conditional — MySQL does not support CREATE INDEX IF NOT EXISTS)
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_content_creators' AND index_name='idx_server_content_creator_member');
SET @s = IF(@i=0,'CREATE INDEX idx_server_content_creator_member ON server_content_creators(member_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_content_creators' AND index_name='idx_server_content_creator_status');
SET @s = IF(@i=0,'CREATE INDEX idx_server_content_creator_status ON server_content_creators(status)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_content_creators' AND index_name='idx_server_content_creator_submitted_at');
SET @s = IF(@i=0,'CREATE INDEX idx_server_content_creator_submitted_at ON server_content_creators(submitted_at)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

-- Add is_content_creator flag (conditional)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'server_member_roles'
      AND column_name = 'is_content_creator'
);
SET @s = IF(@col_exists=0,'ALTER TABLE server_member_roles ADD COLUMN is_content_creator BOOLEAN DEFAULT FALSE','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

-- Add staff report review fields (conditional)
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'server_staff_reports'
      AND column_name = 'reviewed_by_member_id'
);
SET @s = IF(
    @col_exists=0,
    'ALTER TABLE server_staff_reports ADD COLUMN reviewed_by_member_id INT NULL, ADD COLUMN reviewed_at DATETIME NULL, ADD CONSTRAINT fk_server_staff_reports_reviewer FOREIGN KEY (reviewed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL',
    'SELECT 1'
);
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

-- Reviewer index (conditional)
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_reports' AND index_name='idx_server_staff_reports_reviewer');
SET @s = IF(@i=0,'CREATE INDEX idx_server_staff_reports_reviewer ON server_staff_reports(reviewed_by_member_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;
