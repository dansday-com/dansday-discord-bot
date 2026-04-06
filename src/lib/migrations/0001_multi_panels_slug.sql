-- Add stable panel identifier so multiple panels can coexist.

ALTER TABLE panels
	ADD COLUMN slug VARCHAR(64) NULL AFTER id;

UPDATE panels
SET slug = 'default'
WHERE slug IS NULL OR slug = '';

ALTER TABLE panels
	MODIFY COLUMN slug VARCHAR(64) NOT NULL;

ALTER TABLE panels
	ADD UNIQUE KEY uq_panels_slug (slug);

