-- Migration 0002: Rename 'moderator' to 'staff' in server_accounts, server_account_invites, and account_server_access

-- server_accounts: expand enum to include both, update rows, then drop old value
ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner', 'moderator', 'staff') NOT NULL;
UPDATE server_accounts SET account_type = 'staff' WHERE account_type = 'moderator';
ALTER TABLE server_accounts MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;

-- server_account_invites: expand enum to include both, update rows, then drop old value
ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner', 'moderator', 'staff') NOT NULL;
UPDATE server_account_invites SET account_type = 'staff' WHERE account_type = 'moderator';
ALTER TABLE server_account_invites MODIFY COLUMN account_type ENUM('owner', 'staff') NOT NULL;

-- account_server_access: expand enum to include both, update rows, then drop old value
ALTER TABLE account_server_access MODIFY COLUMN role ENUM('owner', 'moderator', 'staff') NOT NULL;
UPDATE account_server_access SET role = 'staff' WHERE role = 'moderator';
ALTER TABLE account_server_access MODIFY COLUMN role ENUM('owner', 'staff') NOT NULL;
