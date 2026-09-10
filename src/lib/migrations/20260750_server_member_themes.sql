CREATE TABLE IF NOT EXISTS server_member_themes (
	id INT PRIMARY KEY AUTO_INCREMENT,
	member_id INT NOT NULL UNIQUE,
	image VARCHAR(191) NULL,
	accent_color VARCHAR(7) NULL,
	accent_auto BOOLEAN NOT NULL DEFAULT TRUE,
	created_at DATETIME NOT NULL,
	updated_at DATETIME NOT NULL,
	CONSTRAINT fk_server_member_themes_member FOREIGN KEY (member_id) REFERENCES server_members (id) ON DELETE CASCADE
);
CREATE INDEX idx_server_member_themes_member_id ON server_member_themes (member_id);
