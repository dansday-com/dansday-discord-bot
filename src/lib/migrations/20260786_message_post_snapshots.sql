SET @add_server_post_content = IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'server_message_posts' AND column_name = 'content') = 0,
    'ALTER TABLE server_message_posts ADD COLUMN content JSON NULL AFTER mentions',
    'DO 0'
);
PREPARE add_server_post_content FROM @add_server_post_content;
EXECUTE add_server_post_content;
DEALLOCATE PREPARE add_server_post_content;

SET @add_post_content = IF(
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'message_posts' AND column_name = 'content') = 0,
    'ALTER TABLE message_posts ADD COLUMN content JSON NULL AFTER mentions',
    'DO 0'
);
PREPARE add_post_content FROM @add_post_content;
EXECUTE add_post_content;
DEALLOCATE PREPARE add_post_content;

UPDATE server_message_posts p
INNER JOIN server_messages m ON m.id = p.message_id
SET p.content = m.content
WHERE p.content IS NULL;

UPDATE message_posts p
INNER JOIN messages m ON m.id = p.message_id
SET p.content = m.content
WHERE p.content IS NULL;
