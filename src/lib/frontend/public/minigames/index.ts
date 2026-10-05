import { loadItemsShared } from '../items/index.js';

export const MINIGAME_CATEGORIES = ['all', 'gamble', 'tower'];

export async function loadMinigamesShared(server: any, hash: string) {
	return loadItemsShared(server, hash, 'minigames');
}
