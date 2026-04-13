ALTER TABLE bot_roblox_items
	MODIFY COLUMN price BIGINT NULL,
	MODIFY COLUMN lowest_resale_price BIGINT NULL,
	MODIFY COLUMN total_quantity BIGINT NULL,
	MODIFY COLUMN last_price BIGINT NULL,
	MODIFY COLUMN last_lowest_resale_price BIGINT NULL,
	MODIFY COLUMN last_total_quantity BIGINT NULL,
	MODIFY COLUMN units_available BIGINT NULL,
	MODIFY COLUMN last_units_available BIGINT NULL;

