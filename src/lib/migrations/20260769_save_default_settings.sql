UPDATE server_settings
SET settings = JSON_INSERT(
    settings,
    '$.items_enabled', CAST('true' AS JSON),
    '$.assets_enabled', CAST('true' AS JSON),
    '$.minigames_enabled', CAST('true' AS JSON),
    '$.tasks_enabled', CAST('true' AS JSON),
    '$.invite_enabled', CAST('true' AS JSON)
)
WHERE component_name = 'public';

UPDATE server_settings
SET settings = JSON_INSERT(settings, '$.INVITE', JSON_OBJECT())
WHERE component_name = 'leveling';

UPDATE server_settings
SET settings = JSON_INSERT(
    settings,
    '$.INVITE.XP', 1000,
    '$.INVITE.MIN_ACCOUNT_AGE_DAYS', 7,
    '$.INVITE.HOLD_HOURS', 24,
    '$.INVITE.SHARE_PERCENT', 25
)
WHERE component_name = 'leveling';

UPDATE server_settings
SET settings = JSON_INSERT(settings, '$.giveaway_min_invites', 0)
WHERE component_name = 'giveaway';
