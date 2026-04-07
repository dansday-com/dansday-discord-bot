-- Rename server_feedbacks to server_member_feedbacks
RENAME TABLE server_feedbacks TO server_member_feedbacks;

-- Rename index
ALTER TABLE server_member_feedbacks DROP INDEX idx_server_feedbacks_member;
CREATE INDEX idx_server_member_feedbacks_member ON server_member_feedbacks(member_id);
