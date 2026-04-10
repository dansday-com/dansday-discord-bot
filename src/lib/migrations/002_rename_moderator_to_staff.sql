-- Migration 0002: Rename 'moderator' to 'staff' in server_accounts, server_account_invites, and account_server_access

-- 1. Update existing 'moderator' rows in server_accounts to 'staff'
UPDATE server_accounts SET account_type = 'staff' WHERE account_type = 'moderator';

-- 2. Alter server_accounts enum to replace 'moderator' with 'staff'
ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;

-- 3. Update existing 'moderator' rows in server_account_invites to 'staff'
UPDATE server_account_invites SET account_type = 'staff' WHERE account_type = 'moderator';

-- 4. Alter server_account_invites enum to replace 'moderator' with 'staff'
ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;

-- 5. Update existing 'moderator' rows in account_server_access to 'staff'
UPDATE account_server_access SET role = 'staff' WHERE role = 'moderator';

-- 6. Alter account_server_access enum to replace 'moderator' with 'staff'
ALTER TABLE account_server_access MODIFY COLUMN role ENUM('owner', 'staff') NOT NULL;
