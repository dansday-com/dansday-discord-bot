UPDATE server_settings
SET settings = JSON_INSERT(
    settings,
    '$.level_rewards', JSON_ARRAY(),
    '$.level_rewards_keep', CAST('true' AS JSON),
    '$.level_rewards_stack', CAST('true' AS JSON)
)
WHERE component_name = 'main';
