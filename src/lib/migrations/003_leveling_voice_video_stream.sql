-- Track voice intervals with camera / Go Live on; used for stats and optional bonus XP (see leveling settings).
ALTER TABLE server_member_levels
    ADD COLUMN voice_minutes_video INT NOT NULL DEFAULT 0 AFTER voice_minutes_afk,
    ADD COLUMN voice_minutes_streaming INT NOT NULL DEFAULT 0 AFTER voice_minutes_video;
