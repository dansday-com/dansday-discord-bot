ALTER TABLE server_members MODIFY COLUMN language VARCHAR(10) NULL DEFAULT NULL;

UPDATE server_members SET language = NULL WHERE language = 'en';
