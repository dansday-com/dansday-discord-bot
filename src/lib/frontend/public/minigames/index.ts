import { loadItemsShared } from '$lib/frontend/public/items/index.js';

export const MINIGAME_CATEGORIES = ['all', 'gamble'];

export async function loadMinigamesShared(server: any, hash: string) {
	const { SERVER_SETTINGS } = await import('$lib/frontend/panelServer.js');
	return loadItemsShared(server, hash, SERVER_SETTINGS.component.minigames);
}
