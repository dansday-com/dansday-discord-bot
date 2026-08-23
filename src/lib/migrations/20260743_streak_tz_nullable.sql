ALTER TABLE server_member_streaks MODIFY COLUMN tz_offset_min INT NULL DEFAULT NULL;
UPDATE server_member_streaks SET tz_offset_min = NULL WHERE tz_offset_min = 0 AND total_claims = 0 AND last_claim_day_key IS NULL;
