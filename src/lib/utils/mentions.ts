const MENTION_CHUNK_MAX_LENGTH = 1950;

export function mentionChunks(discordIds: string[]): string[] {
	const chunks: string[] = [];
	let current = '';
	for (const id of discordIds) {
		const mention = `<@${id}> `;
		if (current.length + mention.length > MENTION_CHUNK_MAX_LENGTH) {
			chunks.push(current.trim());
			current = mention;
		} else {
			current += mention;
		}
	}
	if (current.trim()) {
		chunks.push(current.trim());
	}
	return chunks;
}
