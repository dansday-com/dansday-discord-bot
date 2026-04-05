-- Track camera / Go Live state and last credit times separately from voice_rewarded_at (bot-offline catch-up).
ALTER TABLE server_member_levels
    ADD COLUMN is_in_video BOOLEAN NOT NULL DEFAULT FALSE AFTER is_in_voice,
    ADD COLUMN is_in_stream BOOLEAN NOT NULL DEFAULT FALSE AFTER is_in_video,
    ADD COLUMN video_rewarded_at DATETIME NULL AFTER voice_rewarded_at,
    ADD COLUMN stream_rewarded_at DATETIME NULL AFTER video_rewarded_at;
