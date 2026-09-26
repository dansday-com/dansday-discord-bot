export function separateChannelsAndCategories(guildChannels: Map<string, any>) {
	const channelsArray = Array.from(guildChannels.values());

	const isThreadType = (type: any) => {
		if (typeof type === 'number') return type === 10 || type === 11 || type === 12;
		if (typeof type === 'string') return type === 'GUILD_NEWS_THREAD' || type === 'GUILD_PUBLIC_THREAD' || type === 'GUILD_PRIVATE_THREAD';
		return false;
	};

	const isCategoryType = (type: any) => {
		if (typeof type === 'number') return type === 4;
		if (typeof type === 'string') return type === 'GUILD_CATEGORY';
		return false;
	};

	const isTextOrNewsType = (type: any) => {
		if (typeof type === 'number') return type === 0 || type === 5;
		if (typeof type === 'string') return type === 'GUILD_TEXT' || type === 'GUILD_NEWS';
		return false;
	};

	const isVoiceType = (type: any) => {
		if (typeof type === 'number') return type === 2;
		if (typeof type === 'string') return type === 'GUILD_VOICE';
		return false;
	};

	const isStageType = (type: any) => {
		if (typeof type === 'number') return type === 13;
		if (typeof type === 'string') return type === 'GUILD_STAGE_VOICE';
		return false;
	};

	const allChannels = channelsArray.filter((ch) => {
		const isThreadMethod = ch.isThread ? ch.isThread() : false;
		const isThreadByType = isThreadType(ch.type);
		return !isThreadMethod && !isThreadByType;
	});

	const categories = allChannels.filter((ch) => isCategoryType(ch.type));
	const channels = allChannels.filter((ch) => isTextOrNewsType(ch.type) || isVoiceType(ch.type) || isStageType(ch.type));

	return { categories, channels };
}

const SYNCED_CHANNEL_TYPES = new Set([0, 2, 4, 5, 13]);
const SYNCED_CHANNEL_TYPE_NAMES = new Set(['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'GUILD_NEWS', 'GUILD_STAGE_VOICE']);

export function isSyncedChannelType(channel: any): boolean {
	if (!channel) return false;
	if (channel.isThread ? channel.isThread() : false) return false;
	if (typeof channel.type === 'number') return SYNCED_CHANNEL_TYPES.has(channel.type);
	if (typeof channel.type === 'string') return SYNCED_CHANNEL_TYPE_NAMES.has(channel.type);
	return false;
}

export function channelSyncSignature(channel: any): string {
	if (!channel) return '';
	let viewable: any = null;
	try {
		viewable = channel.viewable;
	} catch (_) {
		viewable = null;
	}
	return [channel.id, channel.name, channel.type, channel.parentId ?? null, channel.position ?? null, viewable].join('\u001f');
}

export function mapCategoriesForSync(categories: any[]) {
	return categories.map((cat) => ({
		id: cat.id,
		name: cat.name,
		position: cat.position !== undefined ? cat.position : null
	}));
}

export function mapChannelsForSync(channels: any[]) {
	const typeMap: Record<number, string> = {
		0: 'GUILD_TEXT',
		2: 'GUILD_VOICE',
		5: 'GUILD_NEWS',
		13: 'GUILD_STAGE_VOICE'
	};

	return channels.map((ch) => {
		let typeValue = ch.type;
		if (typeof ch.type === 'number') {
			typeValue = typeMap[ch.type] || String(ch.type);
		} else if (typeof ch.type !== 'string') {
			typeValue = String(ch.type);
		}
		return {
			id: ch.id,
			name: ch.name,
			type: typeValue,
			parent_id: ch.parentId || null,
			position: ch.position !== undefined ? ch.position : null
		};
	});
}
