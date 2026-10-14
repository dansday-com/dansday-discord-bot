export type SyncableChannel = {
	id: string;
	name?: string | null;
	type: number | string;
	parentId?: string | null;
	position?: number | null;
	viewable?: boolean;
	isThread?: () => boolean;
};

export const CHANNEL_TYPE = {
	GUILD_TEXT: 0,
	GUILD_VOICE: 2,
	GUILD_CATEGORY: 4,
	GUILD_NEWS: 5,
	GUILD_NEWS_THREAD: 10,
	GUILD_PUBLIC_THREAD: 11,
	GUILD_PRIVATE_THREAD: 12,
	GUILD_STAGE_VOICE: 13
} as const;

export type ChannelTypeName = keyof typeof CHANNEL_TYPE;

const LOG_LABELS: Partial<Record<ChannelTypeName, string>> = { GUILD_CATEGORY: 'Category', GUILD_TEXT: 'Text Channel', GUILD_NEWS: 'News Channel' };

export function channelTypeName(type: unknown): ChannelTypeName | null {
	return (Object.keys(CHANNEL_TYPE) as ChannelTypeName[]).find((name) => name === type || CHANNEL_TYPE[name] === type) ?? null;
}

export function channelLogLabel(channel: { type: unknown }) {
	const name = channelTypeName(channel.type);
	return (name && LOG_LABELS[name]) || 'Channel';
}

export function separateChannelsAndCategories<T extends SyncableChannel>(guildChannels: { values(): Iterable<T> }) {
	const channelsArray = Array.from(guildChannels.values());

	const isThreadType = (type: unknown) => {
		if (typeof type === 'number') {
			return type === CHANNEL_TYPE.GUILD_NEWS_THREAD || type === CHANNEL_TYPE.GUILD_PUBLIC_THREAD || type === CHANNEL_TYPE.GUILD_PRIVATE_THREAD;
		}
		if (typeof type === 'string') {
			return type === 'GUILD_NEWS_THREAD' || type === 'GUILD_PUBLIC_THREAD' || type === 'GUILD_PRIVATE_THREAD';
		}
		return false;
	};

	const isCategoryType = (type: unknown) => {
		if (typeof type === 'number') {
			return type === CHANNEL_TYPE.GUILD_CATEGORY;
		}
		if (typeof type === 'string') {
			return type === 'GUILD_CATEGORY';
		}
		return false;
	};

	const isTextOrNewsType = (type: unknown) => {
		if (typeof type === 'number') {
			return type === CHANNEL_TYPE.GUILD_TEXT || type === CHANNEL_TYPE.GUILD_NEWS;
		}
		if (typeof type === 'string') {
			return type === 'GUILD_TEXT' || type === 'GUILD_NEWS';
		}
		return false;
	};

	const isVoiceType = (type: unknown) => {
		if (typeof type === 'number') {
			return type === CHANNEL_TYPE.GUILD_VOICE;
		}
		if (typeof type === 'string') {
			return type === 'GUILD_VOICE';
		}
		return false;
	};

	const isStageType = (type: unknown) => {
		if (typeof type === 'number') {
			return type === CHANNEL_TYPE.GUILD_STAGE_VOICE;
		}
		if (typeof type === 'string') {
			return type === 'GUILD_STAGE_VOICE';
		}
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

const SYNCED_CHANNEL_TYPES = new Set<number>([
	CHANNEL_TYPE.GUILD_TEXT,
	CHANNEL_TYPE.GUILD_VOICE,
	CHANNEL_TYPE.GUILD_CATEGORY,
	CHANNEL_TYPE.GUILD_NEWS,
	CHANNEL_TYPE.GUILD_STAGE_VOICE
]);
const SYNCED_CHANNEL_TYPE_NAMES = new Set(['GUILD_TEXT', 'GUILD_VOICE', 'GUILD_CATEGORY', 'GUILD_NEWS', 'GUILD_STAGE_VOICE']);

export function isSyncedChannelType(channel: SyncableChannel): boolean {
	if (!channel) {
		return false;
	}
	if (channel.isThread ? channel.isThread() : false) {
		return false;
	}
	if (typeof channel.type === 'number') {
		return SYNCED_CHANNEL_TYPES.has(channel.type);
	}
	if (typeof channel.type === 'string') {
		return SYNCED_CHANNEL_TYPE_NAMES.has(channel.type);
	}
	return false;
}

export function channelSyncSignature(channel: SyncableChannel): string {
	if (!channel) {
		return '';
	}
	let viewable: unknown = null;
	try {
		viewable = channel.viewable;
	} catch (_) {
		viewable = null;
	}
	return [channel.id, channel.name, channel.type, channel.parentId ?? null, channel.position ?? null, viewable].join('\u001f');
}

export function mapCategoriesForSync(categories: SyncableChannel[]) {
	return categories.map((cat) => ({
		id: cat.id,
		name: cat.name ?? null,
		position: cat.position !== undefined ? cat.position : null
	}));
}

export function mapChannelsForSync(channels: SyncableChannel[]) {
	const typeMap: Record<number, string> = {
		[CHANNEL_TYPE.GUILD_TEXT]: 'GUILD_TEXT',
		[CHANNEL_TYPE.GUILD_VOICE]: 'GUILD_VOICE',
		[CHANNEL_TYPE.GUILD_NEWS]: 'GUILD_NEWS',
		[CHANNEL_TYPE.GUILD_STAGE_VOICE]: 'GUILD_STAGE_VOICE'
	};

	return channels.map((ch) => {
		const typeValue = typeof ch.type === 'number' ? typeMap[ch.type] || String(ch.type) : String(ch.type);
		return {
			id: ch.id,
			name: ch.name ?? null,
			type: typeValue,
			parent_id: ch.parentId || null,
			position: ch.position !== undefined ? ch.position : null
		};
	});
}
