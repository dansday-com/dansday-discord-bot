ALTER TABLE servers ADD COLUMN greeted_at DATETIME NULL DEFAULT NULL;
UPDATE servers SET greeted_at = created_at WHERE greeted_at IS NULL;
