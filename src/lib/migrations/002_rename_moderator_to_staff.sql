-- Migration 0002: Rename account_type 'moderator' to 'staff' in server_accounts and server_account_invites

-- 1. Update existing 'moderator' rows in server_accounts to 'staff'
UPDATE server_accounts SET account_type = 'staff' WHERE account_type = 'moderator';

-- 2. Alter server_accounts enum to replace 'moderator' with 'staff'
ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;

-- 3. Update existing 'moderator' rows in server_account_invites to 'staff'
UPDATE server_account_invites SET account_type = 'staff' WHERE account_type = 'moderator';

-- 4. Alter server_account_invites enum to replace 'moderator' with 'staff'
ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;
