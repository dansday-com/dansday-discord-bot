DROP PROCEDURE IF EXISTS _add_leaderboard_perf_indexes;
CREATE PROCEDURE _add_leaderboard_perf_indexes()
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_item_logs' AND index_name = 'idx_server_member_item_logs_action_created') THEN
        CREATE INDEX idx_server_member_item_logs_action_created ON server_member_item_logs(action, created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_item_logs' AND index_name = 'idx_server_member_item_logs_action_member') THEN
        CREATE INDEX idx_server_member_item_logs_action_member ON server_member_item_logs(action, member_id, created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_item_logs' AND index_name = 'idx_server_member_item_logs_action_target') THEN
        CREATE INDEX idx_server_member_item_logs_action_target ON server_member_item_logs(action, target_member_id, created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_item_bounties' AND index_name = 'idx_server_member_item_bounties_placed') THEN
        CREATE INDEX idx_server_member_item_bounties_placed ON server_member_item_bounties(placed_by_member_id, created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_item_bounties' AND index_name = 'idx_server_member_item_bounties_created') THEN
        CREATE INDEX idx_server_member_item_bounties_created ON server_member_item_bounties(created_at);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'server_member_level_logs' AND index_name = 'idx_server_member_level_logs_member_created_source') THEN
        CREATE INDEX idx_server_member_level_logs_member_created_source ON server_member_level_logs(member_id, created_at, source);
    END IF;
END;
CALL _add_leaderboard_perf_indexes();
DROP PROCEDURE IF EXISTS _add_leaderboard_perf_indexes;
