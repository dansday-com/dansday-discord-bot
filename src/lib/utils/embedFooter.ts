/** Replace `{server}` and `{year}` in main-config footer templates (Discord embeds, panel preview). */
export function resolveEmbedFooterPlaceholders(footer: string, serverName: string): string {
	const year = new Date().getFullYear();
	return String(footer)
		.replace(/{server}/g, serverName)
		.replace(/{year}/g, String(year));
}
