-- Active content creators: one row per member (member_id PK, created_at)
SET @t_smcc = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creators');
SET @s = IF(@t_smcc = 0,
  'CREATE TABLE server_member_content_creators ( member_id INT NOT NULL PRIMARY KEY, created_at DATETIME NOT NULL, FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE )',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creators' AND index_name='idx_server_member_content_creators_created');
SET @s = IF(@i=0,'CREATE INDEX idx_server_member_content_creators_created ON server_member_content_creators(created_at)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @smr_cc_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_roles' AND COLUMN_NAME = 'is_content_creator'
);
SET @s = IF(@smr_cc_col > 0,
  'INSERT IGNORE INTO server_member_content_creators (member_id, created_at) SELECT smr.member_id, UTC_TIMESTAMP() FROM server_member_roles smr WHERE smr.is_content_creator = TRUE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sm_cc_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_members' AND COLUMN_NAME = 'is_content_creator'
);
SET @s = IF(@sm_cc_col > 0,
  'INSERT IGNORE INTO server_member_content_creators (member_id, created_at) SELECT id, UTC_TIMESTAMP() FROM server_members WHERE is_content_creator = TRUE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@sm_cc_col > 0, 'ALTER TABLE server_members DROP COLUMN is_content_creator', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smr_cc_col > 0, 'ALTER TABLE server_member_roles DROP COLUMN is_content_creator', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Custom supporter role assignments (replaces server_member_roles.is_custom)
SET @t_smcsr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_roles');
SET @s = IF(@t_smcsr = 0,
  'CREATE TABLE server_member_custom_supporter_roles ( member_id INT NOT NULL, role_id INT NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY (member_id, role_id), FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE )',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_roles' AND index_name='idx_server_member_custom_supporter_roles_role');
SET @s = IF(@i=0,'CREATE INDEX idx_server_member_custom_supporter_roles_role ON server_member_custom_supporter_roles(role_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @smr_icustom = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_roles' AND COLUMN_NAME = 'is_custom'
);
SET @s = IF(@smr_icustom > 0,
  'INSERT IGNORE INTO server_member_custom_supporter_roles (member_id, role_id, created_at) SELECT member_id, role_id, UTC_TIMESTAMP() FROM server_member_roles WHERE is_custom = TRUE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@smr_icustom > 0, 'ALTER TABLE server_member_roles DROP COLUMN is_custom', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- server_staff_ratings (legacy): staff_member_id -> member_id, add role_id; drop server_member_roles.is_rating; rename to server_member_staff_ratings.
-- Skip entirely if legacy table never existed (e.g. DB already on new names or staff feature unused).
SET @has_legacy_ssr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_staff_ratings');

SET @ssr_role_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_staff_ratings' AND COLUMN_NAME = 'role_id'
);
SET @s = IF(@has_legacy_ssr > 0 AND @ssr_role_col = 0, 'ALTER TABLE server_staff_ratings ADD COLUMN role_id INT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @smr_ir_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_roles' AND COLUMN_NAME = 'is_rating'
);
SET @s = IF(@has_legacy_ssr > 0 AND @smr_ir_col > 0,
  'UPDATE server_staff_ratings ssr INNER JOIN (SELECT smr.member_id, MIN(smr.id) AS pick FROM server_member_roles smr WHERE smr.is_rating = TRUE GROUP BY smr.member_id) t ON t.member_id = ssr.staff_member_id INNER JOIN server_member_roles smr ON smr.id = t.pick SET ssr.role_id = smr.role_id',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ssr_staff_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_staff_ratings' AND COLUMN_NAME = 'staff_member_id'
);
SET @fk_ssr := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_staff_ratings'
    AND COLUMN_NAME = 'staff_member_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@has_legacy_ssr > 0 AND @fk_ssr IS NOT NULL, CONCAT('ALTER TABLE server_staff_ratings DROP FOREIGN KEY `', @fk_ssr, '`'), 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @uq_ssr = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_ratings' AND index_name='unique_staff_rating');
SET @s = IF(@has_legacy_ssr > 0 AND @uq_ssr>0,'ALTER TABLE server_staff_ratings DROP INDEX unique_staff_rating','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @s = IF(@has_legacy_ssr > 0 AND @ssr_staff_col > 0, 'ALTER TABLE server_staff_ratings CHANGE COLUMN staff_member_id member_id INT NOT NULL', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_ssr_m := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_staff_ratings'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_server_staff_ratings_member'
  LIMIT 1
);
SET @s = IF(@has_legacy_ssr > 0 AND @fk_ssr_m IS NULL,
  'ALTER TABLE server_staff_ratings ADD CONSTRAINT fk_server_staff_ratings_member FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @uq_ssr2 = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_ratings' AND index_name='unique_staff_rating');
SET @s = IF(@has_legacy_ssr > 0 AND @uq_ssr2=0,'ALTER TABLE server_staff_ratings ADD UNIQUE KEY unique_staff_rating (member_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @ix_ssr_m1 = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_ratings' AND index_name='idx_server_staff_ratings_member');
SET @s = IF(@has_legacy_ssr > 0 AND @ix_ssr_m1>0,'ALTER TABLE server_staff_ratings DROP INDEX idx_server_staff_ratings_member','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @ix_ssr_m2 = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_ratings' AND index_name='idx_server_staff_ratings_member');
SET @s = IF(@has_legacy_ssr > 0 AND @ix_ssr_m2=0,'CREATE INDEX idx_server_staff_ratings_member ON server_staff_ratings(member_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @fk_ssr_r := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_staff_ratings'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_server_staff_ratings_role'
  LIMIT 1
);
SET @s = IF(@has_legacy_ssr > 0 AND @fk_ssr_r IS NULL,
  'ALTER TABLE server_staff_ratings ADD CONSTRAINT fk_server_staff_ratings_role FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_staff_ratings' AND index_name='idx_server_staff_ratings_role');
SET @s = IF(@has_legacy_ssr > 0 AND @i=0,'CREATE INDEX idx_server_staff_ratings_role ON server_staff_ratings(role_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @has_smr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_roles');
SET @s = IF(@has_smr > 0 AND @smr_ir_col > 0, 'ALTER TABLE server_member_roles DROP COLUMN is_rating', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @old_ssr_tab = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_staff_ratings');
SET @new_ssr_tab = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings');
SET @s = IF(@old_ssr_tab > 0 AND @new_ssr_tab = 0, 'RENAME TABLE server_staff_ratings TO server_member_staff_ratings', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @new_ssr_tab = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings');
SET @s = IF(@old_ssr_tab = 0 AND @new_ssr_tab = 0,
  'CREATE TABLE server_member_staff_ratings ( id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, member_id INT NOT NULL, role_id INT NULL, current_rating DECIMAL(3,2) DEFAULT 0, total_reports INT DEFAULT 0, created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, UNIQUE KEY unique_member_staff_rating (member_id), FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE SET NULL )',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @mssr_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings');
SET @ix_ssr_old_m = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings' AND index_name='idx_server_staff_ratings_member');
SET @s = IF(@mssr_exists > 0 AND @ix_ssr_old_m > 0, 'ALTER TABLE server_member_staff_ratings DROP INDEX idx_server_staff_ratings_member', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_ssr_new_m = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings' AND index_name='idx_server_member_staff_ratings_member');
SET @s = IF(@mssr_exists > 0 AND @ix_ssr_new_m = 0, 'CREATE INDEX idx_server_member_staff_ratings_member ON server_member_staff_ratings(member_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_ssr_old_r = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings' AND index_name='idx_server_staff_ratings_role');
SET @fk_mssr_role := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_member_staff_ratings'
    AND COLUMN_NAME = 'role_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@mssr_exists > 0 AND @ix_ssr_old_r > 0 AND @fk_mssr_role IS NOT NULL,
  CONCAT('ALTER TABLE server_member_staff_ratings DROP FOREIGN KEY `', @fk_mssr_role, '`'),
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@mssr_exists > 0 AND @ix_ssr_old_r > 0, 'ALTER TABLE server_member_staff_ratings DROP INDEX idx_server_staff_ratings_role', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_ssr_new_r = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_ratings' AND index_name='idx_server_member_staff_ratings_role');
SET @s = IF(@mssr_exists > 0 AND @ix_ssr_new_r = 0, 'CREATE INDEX idx_server_member_staff_ratings_role ON server_member_staff_ratings(role_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_mssr_role_after := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_member_staff_ratings'
    AND COLUMN_NAME = 'role_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@mssr_exists > 0 AND @fk_mssr_role_after IS NULL,
  'ALTER TABLE server_member_staff_ratings ADD CONSTRAINT fk_server_staff_ratings_role FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Tie live stream rows to server_members (not application/review rows)
SET @cc_id_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_content_creators_stream' AND COLUMN_NAME = 'content_creator_id'
);
SET @mem_id_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_content_creators_stream' AND COLUMN_NAME = 'member_id'
);

SET @s = IF(@cc_id_col > 0 AND @mem_id_col = 0,
  'ALTER TABLE server_content_creators_stream ADD COLUMN member_id INT NULL',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE server_content_creators_stream s
INNER JOIN server_content_creators c ON s.content_creator_id = c.id
SET s.member_id = c.member_id
WHERE @cc_id_col > 0;

DELETE FROM server_content_creators_stream WHERE member_id IS NULL AND @cc_id_col > 0;

SET @fk := (
  SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_content_creators_stream'
    AND COLUMN_NAME = 'content_creator_id'
    AND REFERENCED_TABLE_NAME IS NOT NULL
  LIMIT 1
);
SET @s = IF(@fk IS NOT NULL, CONCAT('ALTER TABLE server_content_creators_stream DROP FOREIGN KEY `', @fk, '`'), 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream' AND index_name='idx_cc_stream_creator_started');
SET @s = IF(@i>0,'DROP INDEX idx_cc_stream_creator_started ON server_content_creators_stream','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @s = IF(@cc_id_col > 0, 'ALTER TABLE server_content_creators_stream DROP COLUMN content_creator_id', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@mem_id_col = 0 OR @cc_id_col > 0,
  'ALTER TABLE server_content_creators_stream MODIFY COLUMN member_id INT NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @fk_mem := (
  SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'server_content_creators_stream'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_cc_stream_member'
  LIMIT 1
);
SET @s = IF(@fk_mem IS NULL,
  'ALTER TABLE server_content_creators_stream ADD CONSTRAINT fk_cc_stream_member FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream' AND index_name='idx_cc_streams_member_started');
SET @s = IF(@i=0,'CREATE INDEX idx_cc_streams_member_started ON server_content_creators_stream(member_id, started_at)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

-- Rename content creator application/review queue
SET @old_cc = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creators');
SET @mid_cc = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creator_review');
SET @new_cc = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews');
SET @s = IF(@old_cc > 0 AND @new_cc = 0, 'RENAME TABLE server_content_creators TO server_member_content_creator_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @s = IF(@old_cc = 0 AND @mid_cc > 0 AND @new_cc = 0, 'RENAME TABLE server_content_creator_review TO server_member_content_creator_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @old_sr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_staff_reports');
SET @mid_sr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_staff_report_review');
SET @mid_srr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_staff_rating_reviews');
SET @new_srr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews');
SET @s = IF(@old_sr > 0 AND @new_srr = 0, 'RENAME TABLE server_staff_reports TO server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @s = IF(@old_sr = 0 AND @mid_sr > 0 AND @new_srr = 0, 'RENAME TABLE server_staff_report_review TO server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @s = IF(@mid_srr > 0 AND @new_srr = 0, 'RENAME TABLE server_staff_rating_reviews TO server_member_staff_rating_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @msrr_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews');
SET @s = IF(@msrr_exists = 0,
  'CREATE TABLE server_member_staff_rating_reviews ( id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, reporter_member_id INT NOT NULL, reported_staff_id INT NOT NULL, rating TINYINT NOT NULL CHECK(rating >= 1 AND rating <= 5), category VARCHAR(50) NOT NULL, description TEXT, is_anonymous BOOLEAN DEFAULT 0, status ENUM(''pending'', ''approved'', ''rejected'') DEFAULT ''pending'', reviewed_by_member_id INT NULL, reviewed_at DATETIME NULL, review_reason TEXT NULL, reported_at DATETIME NOT NULL, FOREIGN KEY (reporter_member_id) REFERENCES server_members(id) ON DELETE CASCADE, FOREIGN KEY (reported_staff_id) REFERENCES server_members(id) ON DELETE CASCADE, FOREIGN KEY (reviewed_by_member_id) REFERENCES server_members(id) ON DELETE SET NULL )',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @msrr_exists = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews');
SET @ix_srr_old_st = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_staff_rating_reviews_staff');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_old_st > 0, 'ALTER TABLE server_member_staff_rating_reviews DROP INDEX idx_server_staff_rating_reviews_staff', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_srr_new_st = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_member_staff_rating_reviews_staff');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_new_st = 0, 'CREATE INDEX idx_server_member_staff_rating_reviews_staff ON server_member_staff_rating_reviews(reported_staff_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_srr_old_p = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_staff_rating_reviews_pair');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_old_p > 0, 'ALTER TABLE server_member_staff_rating_reviews DROP INDEX idx_server_staff_rating_reviews_pair', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_srr_new_p = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_member_staff_rating_reviews_pair');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_new_p = 0, 'CREATE INDEX idx_server_member_staff_rating_reviews_pair ON server_member_staff_rating_reviews(reporter_member_id, reported_staff_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_srr_old_stat = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_staff_rating_reviews_status');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_old_stat > 0, 'ALTER TABLE server_member_staff_rating_reviews DROP INDEX idx_server_staff_rating_reviews_status', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_srr_new_stat = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_member_staff_rating_reviews_status');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_new_stat = 0, 'CREATE INDEX idx_server_member_staff_rating_reviews_status ON server_member_staff_rating_reviews(status)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_srr_old_rev = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_staff_rating_reviews_reviewer');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_old_rev > 0, 'ALTER TABLE server_member_staff_rating_reviews DROP INDEX idx_server_staff_rating_reviews_reviewer', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_srr_new_rev = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_staff_rating_reviews' AND index_name='idx_server_member_staff_rating_reviews_reviewer');
SET @s = IF(@msrr_exists > 0 AND @ix_srr_new_rev = 0, 'CREATE INDEX idx_server_member_staff_rating_reviews_reviewer ON server_member_staff_rating_reviews(reviewed_by_member_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Stream tables: final names (atomic rename when both legacy tables exist)
SET @old_stream = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream');
SET @new_stream = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams');
SET @old_log = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream_log');
SET @new_log = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs');
SET @s = IF(@old_stream > 0 AND @new_stream = 0 AND @old_log > 0 AND @new_log = 0,
  'RENAME TABLE server_content_creators_stream TO server_member_content_creator_streams, server_content_creators_stream_log TO server_member_content_creator_stream_logs',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @old_stream = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream');
SET @new_stream = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams');
SET @s = IF(@old_stream > 0 AND @new_stream = 0,
  'RENAME TABLE server_content_creators_stream TO server_member_content_creator_streams',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @old_log = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_content_creators_stream_log');
SET @new_log = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs');
SET @s = IF(@old_log > 0 AND @new_log = 0,
  'RENAME TABLE server_content_creators_stream_log TO server_member_content_creator_stream_logs',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- AFK: legacy -> server_member_afks
SET @old_members_afk = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_members_afk');
SET @mid_afk = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_afk');
SET @new_afks = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_afks');
SET @s = IF(@old_members_afk > 0 AND @new_afks = 0, 'RENAME TABLE server_members_afk TO server_member_afks', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @s = IF(@mid_afk > 0 AND @new_afks = 0, 'RENAME TABLE server_member_afk TO server_member_afks', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @ix_afk_old = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_afks' AND index_name='idx_server_members_afk_member_id');
SET @s = IF(@ix_afk_old > 0, 'ALTER TABLE server_member_afks DROP INDEX idx_server_members_afk_member_id', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_afk_mid = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_afks' AND index_name='idx_server_member_afk_member_id');
SET @s = IF(@ix_afk_mid > 0, 'ALTER TABLE server_member_afks DROP INDEX idx_server_member_afk_member_id', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @ix_afk_new = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_afks' AND index_name='idx_server_member_afks_member_id');
SET @s = IF(@ix_afk_new = 0, 'CREATE INDEX idx_server_member_afks_member_id ON server_member_afks(member_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Idempotent: singular final names from earlier 015 drafts -> plural table names
SET @o1 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator');
SET @n1 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creators');
SET @s = IF(@o1 > 0 AND @n1 = 0, 'RENAME TABLE server_member_content_creator TO server_member_content_creators', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creators' AND index_name='idx_server_member_content_creator_created');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creators DROP INDEX idx_server_member_content_creator_created', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creators' AND index_name='idx_server_member_content_creators_created');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_content_creators_created ON server_member_content_creators(created_at)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @o2 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_role');
SET @n2 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_roles');
SET @s = IF(@o2 > 0 AND @n2 = 0, 'RENAME TABLE server_member_custom_supporter_role TO server_member_custom_supporter_roles', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_roles' AND index_name='idx_server_member_custom_supporter_role_role');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_custom_supporter_roles DROP INDEX idx_server_member_custom_supporter_role_role', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_custom_supporter_roles' AND index_name='idx_server_member_custom_supporter_roles_role');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_custom_supporter_roles_role ON server_member_custom_supporter_roles(role_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @o3 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_review');
SET @n3 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews');
SET @s = IF(@o3 > 0 AND @n3 = 0, 'RENAME TABLE server_member_content_creator_review TO server_member_content_creator_reviews', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_content_creator_member');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_reviews DROP INDEX idx_server_content_creator_member', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_content_creator_status');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_reviews DROP INDEX idx_server_content_creator_status', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_content_creator_submitted_at');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_reviews DROP INDEX idx_server_content_creator_submitted_at', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_member_content_creator_reviews_member');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_content_creator_reviews_member ON server_member_content_creator_reviews(member_id)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_member_content_creator_reviews_status');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_content_creator_reviews_status ON server_member_content_creator_reviews(status)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_reviews' AND index_name='idx_server_member_content_creator_reviews_submitted_at');
SET @s = IF(@i = 0, 'CREATE INDEX idx_server_member_content_creator_reviews_submitted_at ON server_member_content_creator_reviews(submitted_at)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @o4 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream');
SET @n4 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams');
SET @s = IF(@o4 > 0 AND @n4 = 0, 'RENAME TABLE server_member_content_creator_stream TO server_member_content_creator_streams', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams' AND index_name='idx_cc_stream_member_started');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_streams DROP INDEX idx_cc_stream_member_started', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams' AND index_name='idx_cc_streams_member_started');
SET @s = IF(@i = 0, 'CREATE INDEX idx_cc_streams_member_started ON server_member_content_creator_streams(member_id, started_at)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams' AND index_name='idx_cc_stream_status');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_streams DROP INDEX idx_cc_stream_status', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_streams' AND index_name='idx_cc_streams_status');
SET @s = IF(@i = 0, 'CREATE INDEX idx_cc_streams_status ON server_member_content_creator_streams(status)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @o5 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_log');
SET @n5 = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs');
SET @s = IF(@o5 > 0 AND @n5 = 0, 'RENAME TABLE server_member_content_creator_stream_log TO server_member_content_creator_stream_logs', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs' AND index_name='idx_cc_stream_log_stream_time');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_stream_logs DROP INDEX idx_cc_stream_log_stream_time', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs' AND index_name='idx_cc_stream_log_event');
SET @s = IF(@i > 0, 'ALTER TABLE server_member_content_creator_stream_logs DROP INDEX idx_cc_stream_log_event', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs' AND index_name='idx_cc_stream_logs_stream_time');
SET @s = IF(@i = 0, 'CREATE INDEX idx_cc_stream_logs_stream_time ON server_member_content_creator_stream_logs(stream_id, occurred_at)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_content_creator_stream_logs' AND index_name='idx_cc_stream_logs_event');
SET @s = IF(@i = 0, 'CREATE INDEX idx_cc_stream_logs_event ON server_member_content_creator_stream_logs(stream_id, event_type)', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- server_member_roles -> server_member_notifications (channel notification roles only; full role list no longer stored)
SET @t_smn = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_notifications');
SET @s = IF(@t_smn = 0,
  'CREATE TABLE server_member_notifications ( member_id INT NOT NULL, role_id INT NOT NULL, created_at DATETIME NOT NULL, PRIMARY KEY (member_id, role_id), FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE, FOREIGN KEY (role_id) REFERENCES server_roles(id) ON DELETE CASCADE )',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @i = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='server_member_notifications' AND index_name='idx_server_member_notifications_role');
SET @s = IF(@i=0,'CREATE INDEX idx_server_member_notifications_role ON server_member_notifications(role_id)','SELECT 1');
PREPARE si FROM @s; EXECUTE si; DEALLOCATE PREPARE si;

SET @t_smr = (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='server_member_roles');
SET @notif_col = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'server_member_roles' AND COLUMN_NAME = 'is_notification'
);
SET @s = IF(@t_smr > 0 AND @notif_col > 0,
  'INSERT IGNORE INTO server_member_notifications (member_id, role_id, created_at) SELECT member_id, role_id, created_at FROM server_member_roles WHERE is_notification = TRUE',
  'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @s = IF(@t_smr > 0, 'DROP TABLE server_member_roles', 'SELECT 1');
PREPARE stmt FROM @s; EXECUTE stmt; DEALLOCATE PREPARE stmt;
