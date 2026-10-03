UPDATE server_settings
SET settings = JSON_INSERT(
    settings,
    '$.moderation_warn_expiry_days', 0,
    '$.moderation_escalation', JSON_ARRAY(),
    '$.moderation_reason_presets', JSON_ARRAY()
)
WHERE component_name = 'main';
