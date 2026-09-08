INSERT INTO server_settings (server_id, component_name, settings, created_at, updated_at)
SELECT t.server_id, 'main', JSON_OBJECT(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM (
	SELECT p.server_id
	FROM server_settings p
	LEFT JOIN server_settings m ON m.server_id = p.server_id AND m.component_name = 'main'
	WHERE p.component_name = 'permissions' AND JSON_CONTAINS_PATH(p.settings, 'one', '$.staff_roles') AND m.id IS NULL
) t;

INSERT INTO server_settings (server_id, component_name, settings, created_at, updated_at)
SELECT t.server_id, 'content_creator', JSON_OBJECT(), UTC_TIMESTAMP(), UTC_TIMESTAMP()
FROM (
	SELECT p.server_id
	FROM server_settings p
	LEFT JOIN server_settings c ON c.server_id = p.server_id AND c.component_name = 'content_creator'
	WHERE p.component_name = 'permissions' AND JSON_CONTAINS_PATH(p.settings, 'one', '$.content_creator_roles') AND c.id IS NULL
) t;

UPDATE server_settings m
JOIN server_settings p ON p.server_id = m.server_id AND p.component_name = 'permissions'
SET m.settings = JSON_SET(m.settings, '$.staff_roles', JSON_EXTRACT(p.settings, '$.staff_roles'))
WHERE m.component_name = 'main' AND JSON_CONTAINS_PATH(p.settings, 'one', '$.staff_roles');

UPDATE server_settings c
JOIN server_settings p ON p.server_id = c.server_id AND p.component_name = 'permissions'
SET c.settings = JSON_SET(c.settings, '$.content_creator_roles', JSON_EXTRACT(p.settings, '$.content_creator_roles'))
WHERE c.component_name = 'content_creator' AND JSON_CONTAINS_PATH(p.settings, 'one', '$.content_creator_roles');

DELETE FROM server_settings WHERE component_name = 'permissions';
