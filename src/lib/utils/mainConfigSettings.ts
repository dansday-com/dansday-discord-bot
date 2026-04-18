export const DEFAULT_MAIN_EMBED_COLOR = '#ff0000';

import { APP_NAME, APP_DOMAIN } from '../frontend/panelServer.js';

export const DEFAULT_BOT_NICKNAME = APP_NAME;
export const DEFAULT_MAIN_EMBED_FOOTER = `Powered by bot.${APP_DOMAIN} {year}`;

function trimStr(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

export function getEffectiveMainEmbedAppearance(raw: unknown): { color: string; footer: string; bot_nickname: string } {
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const colorIn = trimStr(base.color);
	const color = colorIn.length > 0 && colorIn.replace(/^#/, '').length > 0 ? colorIn : DEFAULT_MAIN_EMBED_COLOR;
	const footerIn = trimStr(base.footer);
	const footer = footerIn.length > 0 ? footerIn : DEFAULT_MAIN_EMBED_FOOTER;
	const nickname = trimStr(base.bot_nickname);
	return { color, footer, bot_nickname: nickname };
}

export function normalizeMainConfigForPanel(raw: unknown): {
	color: string;
	footer: string;
	bot_updates_channel_id: string;
	bot_nickname: string;
} {
	const { color, footer } = getEffectiveMainEmbedAppearance(raw);
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const updateCh = typeof base.bot_updates_channel_id === 'string' ? base.bot_updates_channel_id.trim() : '';
	const nickname = typeof base.bot_nickname === 'string' ? base.bot_nickname.trim() : '';

	return {
		color,
		footer,
		bot_updates_channel_id: updateCh,
		bot_nickname: nickname
	};
}
