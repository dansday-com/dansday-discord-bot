UPDATE server_panel_logs
SET changes = JSON_REMOVE(JSON_SET(changes, '$[0].after', JSON_EXTRACT(changes, '$[1].after')), '$[1]')
WHERE action = 'message_sent'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[0].key')) = 'global message sent'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[1].key')) = 'channels';

UPDATE server_panel_logs
SET action = 'message_post_updated',
    changes = JSON_ARRAY(JSON_OBJECT('key', 'global message updated', 'before', NULL, 'after', JSON_EXTRACT(changes, '$[1].after')))
WHERE action = 'message_saved'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[0].key')) = 'global message edited';

UPDATE server_panel_logs
SET changes = JSON_ARRAY(JSON_OBJECT('key', 'global message removed', 'before', JSON_EXTRACT(changes, '$[1].before'), 'after', NULL))
WHERE action = 'message_post_removed'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[0].key')) = 'global message removed'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[1].key')) = 'channel';

UPDATE server_panel_logs
SET changes = JSON_ARRAY(JSON_OBJECT('key', 'global message deleted, posted copy left in', 'before', NULL, 'after', JSON_EXTRACT(changes, '$[1].after')))
WHERE action = 'message_deleted'
  AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$[0].key')) = 'global message deleted';
