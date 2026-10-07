UPDATE server_settings
SET settings = JSON_REMOVE(JSON_SET(settings, '$.market_enabled', JSON_EXTRACT(settings, '$.assets_enabled')), '$.assets_enabled')
WHERE component_name = 'public' AND JSON_CONTAINS_PATH(settings, 'one', '$.assets_enabled');

UPDATE server_panel_logs
SET changes = JSON_SET(changes, JSON_UNQUOTE(JSON_SEARCH(changes, 'one', 'assets_enabled', NULL, '$[*].key')), 'market_enabled')
WHERE action = 'public' AND JSON_SEARCH(changes, 'one', 'assets_enabled', NULL, '$[*].key') IS NOT NULL;
