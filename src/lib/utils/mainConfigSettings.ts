/** Default embed accent when none is saved (new servers). */
export const DEFAULT_MAIN_EMBED_COLOR = '#ff0000';

/** Default footer template; `{year}` and `{server}` are resolved when embeds are built. */
export const DEFAULT_MAIN_EMBED_FOOTER = 'Powered by bot.dansday.com {year}';

function trimStr(v: unknown): string {
	return typeof v === 'string' ? v.trim() : '';
}

/** Effective color and footer for embeds and panel (fills in defaults when unset or blank). */
export function getEffectiveMainEmbedAppearance(raw: unknown): { color: string; footer: string } {
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const colorIn = trimStr(base.color);
	const color = colorIn.length > 0 && colorIn.replace(/^#/, '').length > 0 ? colorIn : DEFAULT_MAIN_EMBED_COLOR;
	const footerIn = trimStr(base.footer);
	const footer = footerIn.length > 0 ? footerIn : DEFAULT_MAIN_EMBED_FOOTER;
	return { color, footer };
}

export function mainChannelId(raw: unknown): string {
	if (!raw || typeof raw !== 'object') return '';
	const v = (raw as Record<string, unknown>).main_channel;
	return typeof v === 'string' && v.trim() !== '' ? v.trim() : '';
}

export function normalizeMainConfigForPanel(raw: unknown): {
	main_channel: string;
	color: string;
	footer: string;
} {
	const { color, footer } = getEffectiveMainEmbedAppearance(raw);
	return {
		main_channel: mainChannelId(raw),
		color,
		footer
	};
}
