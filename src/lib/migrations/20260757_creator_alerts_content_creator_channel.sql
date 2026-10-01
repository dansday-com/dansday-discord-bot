UPDATE server_settings ca
JOIN server_settings cc ON cc.server_id = ca.server_id AND cc.component_name = 'content_creator'
SET ca.settings = JSON_SET(ca.settings, '$.target_channel_id', JSON_UNQUOTE(JSON_EXTRACT(cc.settings, '$.target_channel_id'))),
	ca.updated_at = UTC_TIMESTAMP()
WHERE ca.component_name = 'creator_alerts'
	AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(ca.settings, '$.target_channel_id')), '') IN ('', 'null')
	AND COALESCE(JSON_UNQUOTE(JSON_EXTRACT(cc.settings, '$.target_channel_id')), '') NOT IN ('', 'null');
