UPDATE server_member_invites i
JOIN server_members m ON m.id = i.member_id
JOIN servers s ON s.id = m.server_id
SET i.source = 'server'
WHERE i.source = 'invite' AND i.inviter_member_id IS NULL AND s.invite_code IS NOT NULL AND i.code = s.invite_code;
