-- Enforce: bots belong to accounts; accounts belong to panels.

-- Ensure default panel exists
INSERT INTO panels (slug, created_at, updated_at)
SELECT 'default', UTC_TIMESTAMP(), UTC_TIMESTAMP()
WHERE NOT EXISTS (SELECT 1 FROM panels WHERE slug = 'default');

-- Backfill accounts.panel_id -> default where NULL
UPDATE accounts a
JOIN panels p ON p.slug = 'default'
SET a.panel_id = p.id
WHERE a.panel_id IS NULL;

-- Make accounts.panel_id NOT NULL and adjust FK (no SET NULL)
ALTER TABLE accounts
	DROP FOREIGN KEY accounts_ibfk_1;

ALTER TABLE accounts
	MODIFY COLUMN panel_id INT NOT NULL,
	ADD CONSTRAINT fk_accounts_panel_id FOREIGN KEY (panel_id) REFERENCES panels(id) ON DELETE RESTRICT;

-- Backfill bots.account_id where NULL -> oldest superadmin (lowest id)
UPDATE bots
SET account_id = (SELECT MIN(id) FROM accounts)
WHERE account_id IS NULL;

-- Replace bots.account_id FK to CASCADE and enforce NOT NULL
ALTER TABLE bots
	DROP FOREIGN KEY bots_ibfk_1;

ALTER TABLE bots
	MODIFY COLUMN account_id INT NOT NULL,
	ADD CONSTRAINT fk_bots_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

