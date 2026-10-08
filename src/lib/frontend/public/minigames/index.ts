import { loadItemsShared } from '../../../backend/public/items/index.js';

export const MINIGAME_CATEGORIES = ['all', 'gamble', 'tower', 'color'];

export async function loadMinigamesShared(server: any, hash: string) {
	return loadItemsShared(server, hash, 'minigames');
}
