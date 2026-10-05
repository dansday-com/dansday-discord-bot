import { normalizeServerLanguage, type ServerLanguage } from '../languages.js';
import { defaultMainEmbedFooter, isDefaultMainEmbedFooter } from '../localizedDefaults.js';
import { DEFAULT_MAIN_EMBED_COLOR } from './mainConfigSettings.js';

function trimStr(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

export function getEffectiveMainEmbedAppearance(raw: unknown): { color: string; footer: string; bot_nickname: string } {
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const colorIn = trimStr(base.color);
	const color = colorIn.length > 0 && colorIn.replace(/^#/, '').length > 0 ? colorIn : DEFAULT_MAIN_EMBED_COLOR;
	const footerIn = trimStr(base.footer);
	const footer = footerIn.length > 0 && !isDefaultMainEmbedFooter(footerIn) ? footerIn : defaultMainEmbedFooter(base.language);
	const nickname = trimStr(base.bot_nickname);
	return { color, footer, bot_nickname: nickname };
}

export function normalizeMainConfigForPanel(raw: unknown): {
	color: string;
	footer: string;
	bot_updates_channel_id: string;
	moderation_log_channel_id: string;
	bot_nickname: string;
	bot_bio: string;
	bot_avatar_url: string;
	bot_banner_url: string;
	staff_roles: string[];
	language: ServerLanguage;
} {
	const { color, footer } = getEffectiveMainEmbedAppearance(raw);
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const updateCh = typeof base.bot_updates_channel_id === 'string' ? base.bot_updates_channel_id.trim() : '';
	const nickname = typeof base.bot_nickname === 'string' ? base.bot_nickname.trim() : '';
	const staffRoles = Array.isArray(base.staff_roles) ? base.staff_roles.map((id) => String(id)).filter(Boolean) : [];

	return {
		color,
		footer,
		bot_updates_channel_id: updateCh,
		moderation_log_channel_id: trimStr(base.moderation_log_channel_id),
		bot_nickname: nickname,
		bot_bio: trimStr(base.bot_bio),
		bot_avatar_url: trimStr(base.bot_avatar_url),
		bot_banner_url: trimStr(base.bot_banner_url),
		staff_roles: staffRoles,
		language: normalizeServerLanguage(base.language)
	};
}
