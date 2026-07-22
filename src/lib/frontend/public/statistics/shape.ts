export type PublicPageStats = {
	members_total: number;
	members_with_levels: number;
	members_unique_boosters: number;
	members_boosters: number;
	member_afk: number;
	channels_total: number;
	channels_text: number;
	channels_voice: number;
	channels_announcement: number;
	channels_stage: number;
	leveling_total_experience: number;
	leveling_avg_level: number;
	leveling_max_level: number;
	leveling_total_chat: number;
	leveling_total_voice_minutes: number;
	leveling_total_voice_active: number;
	leveling_total_voice_afk: number;
	leveling_total_voice_video: number;
	leveling_total_voice_streaming: number;
	roles_total: number;
	categories_total: number;
	members_with_custom_roles: number;
	leveling_wallet_experience: number;
	leveling_assets_value: number;
	assets_invested: number;
	assets_market_value: number;
	assets_unrealized_net: number;
	assets_open_positions: number;
	assets_traders: number;
	assets_buy_volume: number;
	assets_sell_volume: number;
	assets_realized_net: number;
	assets_trade_count: number;
	minigames_wagered: number;
	minigames_paid_out: number;
	minigames_net: number;
	minigames_wins: number;
	minigames_plays: number;
	minigames_biggest_win: number;
	items_stolen: number;
	items_bombed: number;
	items_gifted: number;
	items_steal_attempts: number;
	items_bomb_attempts: number;
	items_spies: number;
	items_bounties_placed: number;
	items_biggest_steal: number;
	items_buys: number;
	items_buy_spend: number;
	items_gifts: number;
	items_discards: number;
	items_activations: number;
	items_steals_caught: number;
	items_steals_landed: number;
	items_distinct_bought: number;
	giveaways_total: number;
	giveaways_active: number;
	giveaways_winners: number;
	giveaways_entrants: number;
	giveaways_entries: number;
	streams_total: number;
	streams_creators: number;
	streams_live_now: number;
	streams_peak_viewers: number;
	streams_likes: number;
	streams_chat_messages: number;
	streams_gifts: number;
	streams_follows: number;
	streams_shares: number;
	streams_unique_chatters: number;
	quests_enrolled: number;
	quests_claimed: number;
	quests_participants: number;
	bounties_placed: number;
	bounties_collected: number;
	bounties_pooled: number;
	staff_reviews: number;
	staff_avg_rating: number;
	feedback_submissions: number;
	afk_active: number;
};

export function shapePublicStatisticsFromOverview(overview: Record<string, unknown> | null | undefined): {
	stats: PublicPageStats;
	boost_level: number;
} | null {
	if (!overview) return null;
	const s = (overview.stats as Record<string, unknown>) ?? {};
	const boostLevel = (overview.boost_level as number | undefined) ?? (s.boost_level as number | undefined) ?? 0;

	return {
		stats: {
			members_total: Number(s.members_total ?? 0),
			members_with_levels: Number(s.members_with_levels ?? 0),
			members_unique_boosters: Number(s.members_unique_boosters ?? 0),
			members_boosters: Number(s.members_boosters ?? 0),
			member_afk: Number(s.member_afk ?? 0),
			channels_total: Number(s.channels_total ?? 0),
			channels_text: Number(s.channels_text ?? 0),
			channels_voice: Number(s.channels_voice ?? 0),
			channels_announcement: Number(s.channels_announcement ?? 0),
			channels_stage: Number(s.channels_stage ?? 0),
			leveling_total_experience: Number(s.leveling_total_experience ?? 0),
			leveling_avg_level: Number(s.leveling_avg_level ?? 0),
			leveling_max_level: Number(s.leveling_max_level ?? 0),
			leveling_total_chat: Number(s.leveling_total_chat ?? 0),
			leveling_total_voice_minutes: Number(s.leveling_total_voice_minutes ?? 0),
			leveling_total_voice_active: Number(s.leveling_total_voice_active ?? 0),
			leveling_total_voice_afk: Number(s.leveling_total_voice_afk ?? 0),
			leveling_total_voice_video: Number(s.leveling_total_voice_video ?? 0),
			leveling_total_voice_streaming: Number(s.leveling_total_voice_streaming ?? 0),
			roles_total: Number(s.roles_total ?? 0),
			categories_total: Number(s.categories_total ?? 0),
			members_with_custom_roles: Number(s.members_with_custom_roles ?? 0),
			leveling_wallet_experience: Number(s.leveling_wallet_experience ?? 0),
			leveling_assets_value: Number(s.leveling_assets_value ?? 0),
			assets_invested: Number(s.assets_invested ?? 0),
			assets_market_value: Number(s.assets_market_value ?? 0),
			assets_unrealized_net: Number(s.assets_unrealized_net ?? 0),
			assets_open_positions: Number(s.assets_open_positions ?? 0),
			assets_traders: Number(s.assets_traders ?? 0),
			assets_buy_volume: Number(s.assets_buy_volume ?? 0),
			assets_sell_volume: Number(s.assets_sell_volume ?? 0),
			assets_realized_net: Number(s.assets_realized_net ?? 0),
			assets_trade_count: Number(s.assets_trade_count ?? 0),
			minigames_wagered: Number(s.minigames_wagered ?? 0),
			minigames_paid_out: Number(s.minigames_paid_out ?? 0),
			minigames_net: Number(s.minigames_net ?? 0),
			minigames_wins: Number(s.minigames_wins ?? 0),
			minigames_plays: Number(s.minigames_plays ?? 0),
			minigames_biggest_win: Number(s.minigames_biggest_win ?? 0),
			items_stolen: Number(s.items_stolen ?? 0),
			items_bombed: Number(s.items_bombed ?? 0),
			items_gifted: Number(s.items_gifted ?? 0),
			items_steal_attempts: Number(s.items_steal_attempts ?? 0),
			items_bomb_attempts: Number(s.items_bomb_attempts ?? 0),
			items_spies: Number(s.items_spies ?? 0),
			items_bounties_placed: Number(s.items_bounties_placed ?? 0),
			items_biggest_steal: Number(s.items_biggest_steal ?? 0),
			items_buys: Number(s.items_buys ?? 0),
			items_buy_spend: Number(s.items_buy_spend ?? 0),
			items_gifts: Number(s.items_gifts ?? 0),
			items_discards: Number(s.items_discards ?? 0),
			items_activations: Number(s.items_activations ?? 0),
			items_steals_caught: Number(s.items_steals_caught ?? 0),
			items_steals_landed: Number(s.items_steals_landed ?? 0),
			items_distinct_bought: Number(s.items_distinct_bought ?? 0),
			giveaways_total: Number(s.giveaways_total ?? 0),
			giveaways_active: Number(s.giveaways_active ?? 0),
			giveaways_winners: Number(s.giveaways_winners ?? 0),
			giveaways_entrants: Number(s.giveaways_entrants ?? 0),
			giveaways_entries: Number(s.giveaways_entries ?? 0),
			streams_total: Number(s.streams_total ?? 0),
			streams_creators: Number(s.streams_creators ?? 0),
			streams_live_now: Number(s.streams_live_now ?? 0),
			streams_peak_viewers: Number(s.streams_peak_viewers ?? 0),
			streams_likes: Number(s.streams_likes ?? 0),
			streams_chat_messages: Number(s.streams_chat_messages ?? 0),
			streams_gifts: Number(s.streams_gifts ?? 0),
			streams_follows: Number(s.streams_follows ?? 0),
			streams_shares: Number(s.streams_shares ?? 0),
			streams_unique_chatters: Number(s.streams_unique_chatters ?? 0),
			quests_enrolled: Number(s.quests_enrolled ?? 0),
			quests_claimed: Number(s.quests_claimed ?? 0),
			quests_participants: Number(s.quests_participants ?? 0),
			bounties_placed: Number(s.bounties_placed ?? 0),
			bounties_collected: Number(s.bounties_collected ?? 0),
			bounties_pooled: Number(s.bounties_pooled ?? 0),
			staff_reviews: Number(s.staff_reviews ?? 0),
			staff_avg_rating: Number(s.staff_avg_rating ?? 0),
			feedback_submissions: Number(s.feedback_submissions ?? 0),
			afk_active: Number(s.afk_active ?? 0)
		},
		boost_level: Number(boostLevel)
	};
}
