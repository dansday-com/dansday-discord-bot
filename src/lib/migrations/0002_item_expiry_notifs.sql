-- Track which timed item effects have had their "expired" notification sent.
ALTER TABLE server_member_item_actives ADD COLUMN expiry_notified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_server_member_item_actives_sweep ON server_member_item_actives(expiry_notified, expires_at);

-- Dedup ledger for derived "event finished" notices (cooldown ready, immunity ended)
-- that aren't backed by a stored effect row.
CREATE TABLE IF NOT EXISTS server_member_item_event_notifs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    kind VARCHAR(24) NOT NULL,
    event_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY unique_member_item_event (member_id, kind, event_at),
    FOREIGN KEY (member_id) REFERENCES server_members(id) ON DELETE CASCADE
);
