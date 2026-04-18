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
			members_with_custom_roles: Number(s.members_with_custom_roles ?? 0)
		},
		boost_level: Number(boostLevel)
	};
}
