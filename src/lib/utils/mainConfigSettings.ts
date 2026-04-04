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
	const base = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	const color = typeof base.color === 'string' && base.color ? base.color : '#5865F2';
	return {
		main_channel: mainChannelId(raw),
		color,
		footer: typeof base.footer === 'string' ? base.footer : ''
	};
}
