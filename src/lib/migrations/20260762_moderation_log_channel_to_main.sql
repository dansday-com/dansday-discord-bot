UPDATE server_settings m
JOIN server_settings x ON x.server_id = m.server_id AND x.component_name = 'moderation'
SET m.settings = JSON_SET(m.settings, '$.moderation_log_channel_id', JSON_UNQUOTE(JSON_EXTRACT(x.settings, '$.log_channel_id'))),
    m.updated_at = UTC_TIMESTAMP()
WHERE m.component_name = 'main'
  AND JSON_EXTRACT(x.settings, '$.enabled') = CAST('true' AS JSON)
  AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(x.settings, '$.log_channel_id')), '') NOT IN ('', 'null')
  AND JSON_EXTRACT(m.settings, '$.moderation_log_channel_id') IS NULL;

DELETE FROM server_settings WHERE component_name = 'moderation';
