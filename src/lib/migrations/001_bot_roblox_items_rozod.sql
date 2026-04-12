ALTER TABLE bot_roblox_items
	DROP COLUMN lowest_price,
	DROP COLUMN last_lowest_price;

ALTER TABLE bot_roblox_items
	ADD COLUMN category varchar(512) NULL AFTER asset_type,
	ADD COLUMN favorite_count int NULL AFTER total_quantity,
	ADD COLUMN units_available int NULL AFTER favorite_count,
	ADD COLUMN last_units_available int NULL AFTER last_total_quantity;

ALTER TABLE bot_roblox_items
	DROP COLUMN item_url;
