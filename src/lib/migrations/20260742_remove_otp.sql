ALTER TABLE accounts DROP COLUMN otp_code;
ALTER TABLE accounts DROP COLUMN otp_expires_at;
ALTER TABLE accounts DROP COLUMN email_verified;
ALTER TABLE server_accounts DROP COLUMN otp_code;
ALTER TABLE server_accounts DROP COLUMN otp_expires_at;
ALTER TABLE server_accounts DROP COLUMN email_verified;
