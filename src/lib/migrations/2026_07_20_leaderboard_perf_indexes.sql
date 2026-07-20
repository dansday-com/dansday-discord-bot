CREATE INDEX IF NOT EXISTS idx_server_member_item_logs_action_created ON server_member_item_logs(action, created_at);
CREATE INDEX IF NOT EXISTS idx_server_member_item_logs_action_member ON server_member_item_logs(action, member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_server_member_item_logs_action_target ON server_member_item_logs(action, target_member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_server_member_item_bounties_placed ON server_member_item_bounties(placed_by_member_id, created_at);
CREATE INDEX IF NOT EXISTS idx_server_member_item_bounties_created ON server_member_item_bounties(created_at);
CREATE INDEX IF NOT EXISTS idx_server_member_level_logs_member_created_source ON server_member_level_logs(member_id, created_at, source);
