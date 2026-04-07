-- Drop old duplicate indexes on accounts (replaced by idx_accounts_*)
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_panel_accounts_email');
SET @sql := IF(@has > 0, 'DROP INDEX idx_panel_accounts_email ON accounts', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_panel_accounts_username');
SET @sql := IF(@has > 0, 'DROP INDEX idx_panel_accounts_username ON accounts', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'accounts' AND INDEX_NAME = 'idx_panel_accounts_panel_id');
SET @sql := IF(@has > 0, 'DROP INDEX idx_panel_accounts_panel_id ON accounts', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop old duplicate indexes on server_member_staff_rating_reviews (replaced by idx_server_member_staff_rating_reviews_*)
SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_staff_rating_reviews' AND INDEX_NAME = 'idx_server_staff_reports_staff');
SET @sql := IF(@has > 0, 'DROP INDEX idx_server_staff_reports_staff ON server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_staff_rating_reviews' AND INDEX_NAME = 'idx_server_staff_reports_pair');
SET @sql := IF(@has > 0, 'DROP INDEX idx_server_staff_reports_pair ON server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_staff_rating_reviews' AND INDEX_NAME = 'idx_server_staff_reports_status');
SET @sql := IF(@has > 0, 'DROP INDEX idx_server_staff_reports_status ON server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_staff_rating_reviews' AND INDEX_NAME = 'idx_server_staff_reports_reviewer');
SET @sql := IF(@has > 0, 'DROP INDEX idx_server_staff_reports_reviewer ON server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
