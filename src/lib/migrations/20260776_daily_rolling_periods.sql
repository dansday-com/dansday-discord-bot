UPDATE server_member_streaks s
SET s.last_claim_day_key = COALESCE(
    (
        SELECT TIMESTAMPDIFF(MINUTE, '1970-01-01 00:00:00', MIN(t.created_at))
        FROM server_member_tasks t
        WHERE t.member_id = s.member_id AND t.period = 'daily' AND t.day_key = s.last_claim_day_key
    ),
    s.last_claim_day_key * 1440 + COALESCE(s.tz_offset_min, 0)
)
WHERE s.last_claim_day_key IS NOT NULL AND s.last_claim_day_key < 10000000;

UPDATE server_member_tasks
SET day_key = TIMESTAMPDIFF(MINUTE, '1970-01-01 00:00:00', created_at)
WHERE day_key < 10000000;

UPDATE server_member_claims
SET last_claim_day_key = TIMESTAMPDIFF(MINUTE, '1970-01-01 00:00:00', updated_at)
WHERE last_claim_day_key IS NOT NULL AND last_claim_day_key < 10000000;
