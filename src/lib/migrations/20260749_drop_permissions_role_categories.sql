UPDATE server_settings
SET settings = JSON_REMOVE(settings, '$.member_roles', '$.supporter_roles', '$.admin_roles')
WHERE component_name = 'permissions' AND JSON_CONTAINS_PATH(settings, 'one', '$.member_roles', '$.supporter_roles', '$.admin_roles');
