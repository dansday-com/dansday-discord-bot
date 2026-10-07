UPDATE server_settings
SET settings = JSON_REMOVE(JSON_SET(settings, '$.rewards', JSON_EXTRACT(settings, '$.level_rewards')), '$.level_rewards')
WHERE component_name = 'main' AND JSON_CONTAINS_PATH(settings, 'one', '$.level_rewards');

UPDATE server_settings
SET settings = JSON_REMOVE(JSON_SET(settings, '$.rewards_keep', JSON_EXTRACT(settings, '$.level_rewards_keep')), '$.level_rewards_keep')
WHERE component_name = 'main' AND JSON_CONTAINS_PATH(settings, 'one', '$.level_rewards_keep');

UPDATE server_settings
SET settings = JSON_REMOVE(JSON_SET(settings, '$.rewards_stack', JSON_EXTRACT(settings, '$.level_rewards_stack')), '$.level_rewards_stack')
WHERE component_name = 'main' AND JSON_CONTAINS_PATH(settings, 'one', '$.level_rewards_stack');

UPDATE server_panel_logs
SET changes = JSON_SET(changes, '$[0].key', 'rewards')
WHERE action = 'level_rewards' AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[0].key')) = 'level rewards';

UPDATE server_panel_logs SET action = 'rewards' WHERE action = 'level_rewards';
