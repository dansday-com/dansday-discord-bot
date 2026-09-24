UPDATE server_settings
SET settings = JSON_SET(settings, '$.footer', REPLACE(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.footer')), 'bot.dansday.com', 'dansday.dev'))
WHERE component_name = 'main'
	AND JSON_UNQUOTE(JSON_EXTRACT(settings, '$.footer')) LIKE '%bot.dansday.com%';

UPDATE server_settings
SET settings = JSON_SET(settings, '$.footer', REPLACE(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.footer')), 'dansday.com', 'dansday.dev'))
WHERE component_name = 'main'
	AND JSON_UNQUOTE(JSON_EXTRACT(settings, '$.footer')) LIKE '%dansday.com%';

UPDATE bot_status SET activity_name = 'dansday.dev' WHERE activity_name IN ('bot.dansday.com', 'dansday.com');

UPDATE server_bot_status SET activity_name = 'dansday.dev' WHERE activity_name IN ('bot.dansday.com', 'dansday.com');
