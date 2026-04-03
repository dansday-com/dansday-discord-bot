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

CREATE INDEX IF NOT EXISTS idx_server_content_creator_member ON server_content_creators(member_id);
CREATE INDEX IF NOT EXISTS idx_server_content_creator_status ON server_content_creators(status);
CREATE INDEX IF NOT EXISTS idx_server_content_creator_submitted_at ON server_content_creators(submitted_at);

ALTER TABLE server_member_roles
ADD COLUMN is_content_creator BOOLEAN DEFAULT FALSE;

ALTER TABLE server_staff_reports
ADD COLUMN reviewed_by_member_id INT NULL,
ADD COLUMN reviewed_at DATETIME NULL,
ADD CONSTRAINT fk_server_staff_reports_reviewer
    FOREIGN KEY (reviewed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_server_staff_reports_reviewer ON server_staff_reports(reviewed_by_member_id);
