INSERT INTO server_settings (server_id, component_name, settings, created_at, updated_at)
SELECT s.id, 'leaver', CAST('{"enabled": true}' AS JSON), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM servers s
WHERE NOT EXISTS (
	SELECT 1 FROM server_settings ss WHERE ss.server_id = s.id AND ss.component_name = 'leaver'
);
