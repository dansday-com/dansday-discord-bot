-- Drop bot testing mode flag (replaced by single main channel in main_config).
SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'bots' AND column_name = 'is_testing');
SET @s = IF(@col > 0, 'ALTER TABLE bots DROP COLUMN is_testing', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

SET @col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_bots' AND column_name = 'is_testing');
SET @s = IF(@col > 0, 'ALTER TABLE server_bots DROP COLUMN is_testing', 'SELECT 1');
PREPARE st FROM @s;
EXECUTE st;
DEALLOCATE PREPARE st;

-- main_config: store only `main_channel` (one-time merge from old keys if present).
UPDATE server_settings
SET settings = JSON_REMOVE(
	JSON_REMOVE(
		JSON_SET(
			settings,
			'$.main_channel',
			COALESCE(
				NULLIF(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.main_channel')), ''),
				NULLIF(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.production_channel')), ''),
				NULLIF(JSON_UNQUOTE(JSON_EXTRACT(settings, '$.testing_channel')), '')
			)
		),
		'$.production_channel'
	),
	'$.testing_channel'
)
WHERE component_name = 'main_config';
