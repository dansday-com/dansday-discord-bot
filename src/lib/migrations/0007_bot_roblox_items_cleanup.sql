ALTER TABLE bot_roblox_items
    DROP COLUMN IF EXISTS item_type,
    DROP COLUMN IF EXISTS collectible_item_id,
    DROP COLUMN IF EXISTS creator_type,
    DROP COLUMN IF EXISTS creator_target_id,
    DROP COLUMN IF EXISTS is_official,
    DROP COLUMN IF EXISTS is_limited,
    DROP COLUMN IF EXISTS is_free;
