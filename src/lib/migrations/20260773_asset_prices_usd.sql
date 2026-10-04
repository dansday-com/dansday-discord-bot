ALTER TABLE server_member_assets MODIFY COLUMN buy_price DECIMAL(36, 18) NOT NULL;

ALTER TABLE server_member_asset_logs MODIFY COLUMN price DECIMAL(36, 18) NOT NULL DEFAULT 0;

START TRANSACTION;

UPDATE server_member_assets SET buy_price = buy_price / 17888.5;

UPDATE server_member_asset_logs SET price = price / 17888.5;

COMMIT;
