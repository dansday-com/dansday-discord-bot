import db from '../../database.js';
import { resolveMemberTheme } from '../../themes.js';

export type RowTheme = { theme_image: string | null; theme_accent: string | null };

export async function memberThemeMap(serverId: number): Promise<Map<string, RowTheme>> {
	const rows = await db.getMemberThemesForServer(serverId).catch(() => []);
	const map = new Map<string, RowTheme>();
	for (const row of rows as any[]) {
		const theme = resolveMemberTheme(row);
		if (theme) map.set(String(row.discord_member_id), { theme_image: theme.image, theme_accent: theme.accent });
	}
	return map;
}

export async function attachMemberThemes<T extends { discord_member_id: any }>(serverId: number, rows: T[]): Promise<(T & Partial<RowTheme>)[]> {
	if (rows.length === 0) return rows;
	const themes = await memberThemeMap(serverId);
	if (themes.size === 0) return rows;
	return rows.map((row) => {
		const theme = themes.get(String(row.discord_member_id));
		return theme ? { ...row, ...theme } : row;
	});
}
