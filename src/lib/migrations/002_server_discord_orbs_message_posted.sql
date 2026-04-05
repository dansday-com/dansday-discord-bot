-- Track whether an orb quest embed was actually sent to the configured channel (vs. only synced from API).
-- Backfill: treat historical rows as already posted so a deploy does not re-notify every active quest.
ALTER TABLE server_discord_orbs
    ADD COLUMN orb_message_posted_at DATETIME NULL AFTER notified_at;
