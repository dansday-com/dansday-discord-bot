import { loadItemsShared } from '../../../backend/public/items/index.js';
import type { ServerRow } from '../../../schema.js';

export const MINIGAME_CATEGORIES = ['all', 'gamble', 'tower', 'color'];

export async function loadMinigamesShared(server: Pick<ServerRow, 'id'>, hash: string) {
	return loadItemsShared(server, hash, 'minigames');
}
