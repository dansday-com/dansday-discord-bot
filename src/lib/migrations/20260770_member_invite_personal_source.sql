UPDATE server_member_invites i
JOIN server_member_invite_links l ON l.code = i.code AND l.member_id = i.inviter_member_id
SET i.source = 'personal'
WHERE i.source = 'invite';
