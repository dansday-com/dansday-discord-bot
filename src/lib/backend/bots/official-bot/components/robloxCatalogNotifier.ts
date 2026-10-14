import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, StringSelectMenuBuilder, MessageFlags } from 'discord.js';
import type { ButtonInteraction, GuildTextBasedChannel, MessageActionRowComponentBuilder, StringSelectMenuInteraction } from 'discord.js';
import { randomInt } from 'node:crypto';
import db, { snapshotBigIntOrNull, type RobloxItemChange } from '../../../../database.js';
import { isUsableRobloxThumbnail } from '../../../../roblox-thumbnails.js';
import {
	fetchCatalogFirstPage,
	fetchCatalogItemsByRefs,
	getEmbedConfig,
	getServerForCurrentBot,
	isComponentFeatureEnabled,
	robloxCatalogEmbedColors,
	robloxCatalogItemUrl,
	robloxCatalogStreams,
	robloxCatalogStreamPollOrder,
	ROBLOX_CATALOG_NOTIFICATION_INTERVAL_MS,
	ROBLOX_CATALOG_NOTIFICATION_MAX_ASSETS,
	ROBLOX_CATALOG_POLL_MS,
	serverSettingsComponent,
	streamCatalogPages,
	type RobloxCatalogItem,
	type RobloxCatalogItemRef
} from '../../../config.js';
import { serverTranslator, translate, type Translator } from '../i18n.js';
import { logger } from '../../../../utils/index.js';
import { sendWithWatcherMentions } from './notifiedMentions.js';
import { SECOND_MS } from '../../../../utils/time.js';
import { DISCORD_LIMITS } from '../../../../discordLimits.js';
import { isoDay } from '../../../../utils/datetime.js';

export const ROBLOX_ITEM_NOTIFICATION_BUTTON_PREFIX = 'roblox_item_notification:';
export const ROBLOX_ITEM_NOTIFICATION_TYPES_SELECT_PREFIX = 'roblox_item_notification_types:';
export const ROBLOX_NOTIFICATIONS_MENU_BUTTON_ID = 'notifications_roblox';
export const ROBLOX_NOTIFICATIONS_SELECT_ID = 'roblox_notifications_select';
export const ROBLOX_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID = 'roblox_notifications_disable_all';

const ROBLOX_NOTIFICATION_TYPES = ['price', 'lowest_resale_price', 'units_available', 'total_quantity'] as const;
type RobloxNotificationType = (typeof ROBLOX_NOTIFICATION_TYPES)[number];

const ROBLOX_NOTIFICATION_TYPE_EMOJI: Record<RobloxNotificationType, string> = {
	price: '💰',
	lowest_resale_price: '🔁',
	units_available: '📦',
	total_quantity: '🧮'
};

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let isTickRunning = false;

const groupedInteger = new Intl.NumberFormat('id-ID');

function shuffledCatalogPollOrder(): (typeof robloxCatalogStreamPollOrder)[number][] {
	const arr = [...robloxCatalogStreamPollOrder] as (typeof robloxCatalogStreamPollOrder)[number][];
	for (let i = arr.length - 1; i > 0; i--) {
		const j = randomInt(i + 1);
		[arr[i], arr[j]] = [arr[j], arr[i]];
	}
	return arr;
}

function catalogAssetBi(item: Pick<RobloxCatalogItem, 'id'>): bigint {
	const { id } = item;
	if (typeof id !== 'number' || !Number.isInteger(id) || !Number.isFinite(id)) {
		throw new Error(`[roblox-catalog-notifier] invalid asset id (expected finite integer): ${String(id)}`);
	}
	return BigInt(id);
}

function isOfficialRobloxAccount(item: RobloxCatalogItem): boolean {
	if (item.creatorTargetId !== 1) {
		return false;
	}
	const ct = (item.creatorType ?? '').trim().toLowerCase();
	return ct === '' || ct === 'user' || ct === '1';
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const FREE_ROBUX = 0n;
const NEW_OFFICIAL_ITEM_COLOR = 0xffd700;
const MENU_SUBSCRIPTIONS_SHOWN = DISCORD_LIMITS.SELECT_OPTIONS;

function formatRobux(n: number | bigint, tr: Translator): string {
	const b = typeof n === 'bigint' ? n : BigInt(Math.trunc(Number(n)));
	if (b === FREE_ROBUX) {
		return tr('robloxCatalog.post.free');
	}
	if (b > MAX_SAFE_BIGINT || b < -MAX_SAFE_BIGINT) {
		return `${b.toLocaleString('id-ID')} Robux`;
	}
	return `${groupedInteger.format(Number(b))} Robux`;
}

function formatCount(n: number | bigint): string {
	const b = typeof n === 'bigint' ? n : BigInt(Math.trunc(Number(n)));
	if (b > MAX_SAFE_BIGINT || b < -MAX_SAFE_BIGINT) {
		return b.toLocaleString('id-ID');
	}
	return groupedInteger.format(Number(b));
}

function formatQuantityRatio(item: RobloxCatalogItem): string {
	const u = item.unitsAvailable;
	const t = item.totalQuantity;
	if (u != null && t != null) {
		return `${formatCount(u)}/${formatCount(t)}`;
	}
	if (u != null) {
		return `${formatCount(u)}/—`;
	}
	if (t != null) {
		return `—/${formatCount(t)}`;
	}
	return '—';
}

type ServerTarget = {
	serverId: number;
	guildId: string;
	channelId: string;
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>;
	tr: Translator;
	channel: GuildTextBasedChannel;
};

function toSnapshot(x: RobloxCatalogItem) {
	return {
		assetId: x.id,
		assetType: x.assetType ?? null,
		category: x.category ?? null,
		name: x.name ?? null,
		description: x.description ?? null,
		creatorName: x.creatorName ?? null,
		price: snapshotBigIntOrNull(x.price),
		lowestResalePrice: snapshotBigIntOrNull(x.lowestResalePrice),
		totalQuantity: snapshotBigIntOrNull(x.totalQuantity),
		unitsAvailable: snapshotBigIntOrNull(x.unitsAvailable),
		favoriteCount: x.favoriteCount ?? null,
		thumbnailUrl: x.thumbnailUrl ?? null,
		itemCreatedUtc: x.itemCreatedUtc ?? null
	};
}

function utcDay(utcStr: string): string {
	return isoDay(new Date(utcStr));
}

function utcCalendarDayMinusDays(offsetDays: number): string {
	const d = new Date();
	const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offsetDays);
	return isoDay(new Date(t));
}

function announceDayFromMergedFirstPages(items: RobloxCatalogItem[]): string | null {
	const daySet = new Set<string>();
	for (const x of items) {
		if (x.itemCreatedUtc) {
			daySet.add(utcDay(x.itemCreatedUtc));
		}
	}
	if (daySet.size === 0) {
		return null;
	}
	const today = utcCalendarDayMinusDays(0);
	if (daySet.has(today)) {
		return today;
	}
	const winTs = maxItemCreatedTs(items);
	if (winTs > 0) {
		return utcDay(new Date(winTs).toISOString());
	}
	return [...daySet].sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function maxItemCreatedTs(items: RobloxCatalogItem[]): number {
	let m = 0;
	for (const x of items) {
		if (!x.itemCreatedUtc) {
			continue;
		}
		const t = new Date(x.itemCreatedUtc).getTime();
		if (Number.isFinite(t) && t > m) {
			m = t;
		}
	}
	return m;
}

function sortItemsByCreatedOldestFirst(items: RobloxCatalogItem[]): RobloxCatalogItem[] {
	return [...items].sort((a, b) => {
		const at = a.itemCreatedUtc ? new Date(a.itemCreatedUtc).getTime() : Number.POSITIVE_INFINITY;
		const bt = b.itemCreatedUtc ? new Date(b.itemCreatedUtc).getTime() : Number.POSITIVE_INFINITY;
		if (at !== bt) {
			return at - bt;
		}
		return a.id - b.id;
	});
}

async function getActiveServers(client: Client, officialBotId: number): Promise<ServerTarget[]> {
	const servers = await db.getServersForBot(officialBotId);
	const targets: ServerTarget[] = [];

	for (const server of servers) {
		const guildId = server.discord_server_id;
		if (!guildId) {
			continue;
		}
		if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.roblox_catalog_notifier))) {
			continue;
		}

		const row = await db.getServerSettings(server.id, serverSettingsComponent.roblox_catalog_notifier).catch(() => null);
		const s = row && !Array.isArray(row) && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};

		const channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) {
			continue;
		}

		const guild = await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) {
			continue;
		}
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			continue;
		}

		const embedConfig = await getEmbedConfig(guildId);
		const tr = await serverTranslator(guildId);
		targets.push({ serverId: server.id, guildId, channelId, embedConfig, tr, channel });
	}

	return targets;
}

function changeFieldLabel(field: RobloxItemChange['field'], tr: Translator): string {
	if (field === 'total_quantity') {
		return tr('robloxCatalog.notifications.types.total_quantity.label');
	}
	if (field === 'units_available') {
		return tr('robloxCatalog.notifications.types.units_available.label');
	}
	if (field === 'lowest_resale_price') {
		return tr('robloxCatalog.notifications.types.lowest_resale_price.label');
	}
	return tr('robloxCatalog.notifications.types.price.label');
}

function formatChangeLines(changes: RobloxItemChange[], tr: Translator): string | undefined {
	if (changes.length === 0) {
		return undefined;
	}
	return changes
		.map((c) => {
			const isPrice = c.field === 'price' || c.field === 'lowest_resale_price';
			const fmt = (v: bigint | number | null) => (v == null ? '—' : isPrice ? formatRobux(v, tr) : formatCount(v));
			return `**${changeFieldLabel(c.field, tr)}**: ${fmt(c.oldValue)} → ${fmt(c.newValue)}`;
		})
		.join('\n');
}

type ItemPostFlags = { isNew: boolean; changes: RobloxItemChange[]; fromOfficialRobloxCatalogQuery: boolean };

type EmbedField = { name: string; value: string; inline: boolean };
type ItemLook = { isNew: boolean; isOfficial: boolean; hasChanges: boolean };

function resaleOrSaleFields(item: RobloxCatalogItem, tr: Translator): EmbedField[] {
	if (item.hasResellers && typeof item.lowestResalePrice === 'number') {
		return [{ name: tr('robloxCatalog.post.fields.resalePrice'), value: formatRobux(item.lowestResalePrice, tr), inline: true }];
	}
	const ts = item.offSaleDeadline ? Math.floor(new Date(item.offSaleDeadline).getTime() / SECOND_MS) : NaN;
	return Number.isFinite(ts) ? [{ name: tr('robloxCatalog.post.fields.saleEnds'), value: `<t:${ts}:F>`, inline: true }] : [];
}

function itemDetailFields(item: RobloxCatalogItem, { tr, watcherCount }: { tr: Translator; watcherCount: number }): EmbedField[] {
	const createdAt = item.itemCreatedUtc ? `<t:${Math.floor(new Date(item.itemCreatedUtc).getTime() / SECOND_MS)}:D>` : '—';
	return [
		{ name: tr('robloxCatalog.post.fields.category'), value: (item.category?.trim() || '—').slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE), inline: true },
		{ name: tr('robloxCatalog.post.fields.price'), value: typeof item.price === 'number' ? formatRobux(item.price, tr) : '—', inline: true },
		{
			name: tr('robloxCatalog.post.fields.creator'),
			value: (item.creatorHasVerifiedBadge ? `✅ ${item.creatorName}` : item.creatorName || '—').slice(0, DISCORD_LIMITS.EMBED_FIELD_VALUE),
			inline: true
		},
		{ name: tr('robloxCatalog.post.fields.quantity'), value: formatQuantityRatio(item), inline: true },
		{ name: tr('robloxCatalog.post.fields.favorites'), value: typeof item.favoriteCount === 'number' ? formatCount(item.favoriteCount) : '—', inline: true },
		...resaleOrSaleFields(item, tr),
		{ name: tr('robloxCatalog.post.fields.created'), value: createdAt, inline: true },
		...(watcherCount > 0 ? [{ name: tr('robloxCatalog.post.fields.notifications'), value: `🔔 ${formatCount(watcherCount)}`, inline: true }] : [])
	];
}

function itemEmbedColor({ isNew, isOfficial, hasChanges }: ItemLook, fallback: number) {
	if (isNew && isOfficial) {
		return NEW_OFFICIAL_ITEM_COLOR;
	}
	if (isOfficial) {
		return robloxCatalogEmbedColors.fromOfficialQuery;
	}
	return hasChanges ? robloxCatalogEmbedColors.itemUpdated : fallback;
}

function itemButtons(item: RobloxCatalogItem, tr: Translator) {
	return new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setStyle(ButtonStyle.Link)
			.setURL(robloxCatalogItemUrl(item.id))
			.setLabel(tr('robloxCatalog.post.openOnRoblox').slice(0, DISCORD_LIMITS.BUTTON_LABEL))
			.setEmoji('🛍️'),
		new ButtonBuilder()
			.setStyle(ButtonStyle.Secondary)
			.setCustomId(`${ROBLOX_ITEM_NOTIFICATION_BUTTON_PREFIX}${item.id}`)
			.setLabel(tr('robloxCatalog.post.notifyMe').slice(0, DISCORD_LIMITS.BUTTON_LABEL))
			.setEmoji('🔔')
	);
}

async function itemWatchers(target: ServerTarget, item: RobloxCatalogItem, { isNew, changes }: { isNew: boolean; changes: RobloxItemChange[] }) {
	const watcherDiscordIds = await db.listServerRobloxItemNotificationDiscordIds(target.serverId, catalogAssetBi(item)).catch(() => [] as string[]);
	const changedFields = changes.map((c) => c.field);
	const notificationDiscordIds =
		isNew || changedFields.length === 0
			? watcherDiscordIds
			: await db.listServerRobloxItemNotificationDiscordIds(target.serverId, catalogAssetBi(item), changedFields).catch(() => [] as string[]);
	return { watcherDiscordIds, notificationDiscordIds };
}

async function sendItemEmbed(
	target: ServerTarget,
	item: RobloxCatalogItem,
	{ isNew, changes, fromOfficialRobloxCatalogQuery: isFromOfficialRobloxCatalogQuery }: ItemPostFlags
) {
	const { tr } = target;
	const changeLines = isNew ? undefined : formatChangeLines(changes, tr);
	const isOfficial = isOfficialRobloxAccount(item) || isFromOfficialRobloxCatalogQuery;
	const itemName = item.name || tr('robloxCatalog.itemFallback', { id: item.id });
	const { watcherDiscordIds, notificationDiscordIds } = await itemWatchers(target, item, { isNew, changes });

	const embed = new EmbedBuilder()
		.setColor(itemEmbedColor({ isNew, isOfficial, hasChanges: !!changeLines }, target.embedConfig.COLOR))
		.setTitle((isNew ? itemName : tr('robloxCatalog.post.updatedTitle', { name: itemName })).slice(0, DISCORD_LIMITS.EMBED_TITLE))
		.addFields(itemDetailFields(item, { tr, watcherCount: watcherDiscordIds.length }))
		.setFooter({ text: target.embedConfig.FOOTER });

	const description = changeLines || item.description?.trim();
	if (description) {
		embed.setDescription(description.slice(0, DISCORD_LIMITS.EMBED_DESCRIPTION));
	}
	if (isUsableRobloxThumbnail(item.thumbnailUrl)) {
		embed.setThumbnail(item.thumbnailUrl as string);
	}

	await sendWithWatcherMentions(target.channel, { embeds: [embed], components: [itemButtons(item, tr)] }, notificationDiscordIds);
}

async function initialSeed(officialBotId: number, targets: ServerTarget[]) {
	await logger.log('🛍️ Roblox catalog: DB empty, performing initial seed...');

	const pollOrder = shuffledCatalogPollOrder();
	const firstPageResults = await Promise.all(pollOrder.map((key) => fetchCatalogFirstPage(robloxCatalogStreams[key].params)));

	const assetIdsFromOfficialQuery = new Set<bigint>();
	for (let i = 0; i < pollOrder.length; i++) {
		if (robloxCatalogStreams[pollOrder[i]].useOfficialCatalogEmbedStyle) {
			for (const item of firstPageResults[i]) {
				assetIdsFromOfficialQuery.add(catalogAssetBi(item));
			}
		}
	}

	const seenIds = new Set<bigint>();
	const all: RobloxCatalogItem[] = [];
	for (const items of firstPageResults) {
		for (const item of items) {
			const aid = catalogAssetBi(item);
			if (seenIds.has(aid)) {
				continue;
			}
			seenIds.add(aid);
			all.push(item);
		}
	}

	const announceDay = announceDayFromMergedFirstPages(all);
	const toPost = announceDay ? sortItemsByCreatedOldestFirst(all.filter((x) => x.itemCreatedUtc && utcDay(x.itemCreatedUtc) === announceDay)) : [];

	await logger.log(`🛍️ Roblox catalog: seed found ${all.length} total, posting ${toPost.length} first-announce items (${announceDay ?? 'no dated items'} UTC)`);

	for (const target of targets) {
		await db.syncServerRobloxItemsFromApi(officialBotId, target.serverId, all.map(toSnapshot));

		const unposted = new Set(
			await db.listServerRobloxUnpostedAssetIds(
				target.serverId,
				toPost.map((x) => catalogAssetBi(x))
			)
		);

		for (const item of toPost) {
			if (!unposted.has(catalogAssetBi(item))) {
				continue;
			}
			try {
				await sendItemEmbed(target, item, { isNew: true, changes: [], fromOfficialRobloxCatalogQuery: assetIdsFromOfficialQuery.has(catalogAssetBi(item)) });
				await db.markServerRobloxItemMessagePosted(target.serverId, catalogAssetBi(item));
				await logger.log(`🛍️ Roblox catalog: seeded item ${item.id} → ${target.channelId}`);
			} catch (err) {
				await logger.log(`❌ Roblox catalog: failed to seed item ${item.id}: ${(err as Error)?.message || err}`);
			}
		}
	}

	backgroundSync(officialBotId, targets, seenIds).catch((err) => logger.log(`⚠️ Roblox catalog: background sync error: ${err?.message || err}`));
}

let processPageCount: Record<string, number> = {};

type PageBatch = {
	items: RobloxCatalogItem[];
	seen: Set<bigint>;
	fromOfficialRobloxCatalogQuery: boolean;
	allowCatalogFirstMessage: boolean;
	logLabel?: string;
};

async function processPage(
	officialBotId: number,
	targets: ServerTarget[],
	{ items, seen, fromOfficialRobloxCatalogQuery: isFromOfficialRobloxCatalogQuery, allowCatalogFirstMessage: isAllowCatalogFirstMessage, logLabel }: PageBatch
) {
	const newItems = items.filter((x) => !seen.has(catalogAssetBi(x)));
	for (const x of newItems) {
		seen.add(catalogAssetBi(x));
	}
	const logKey = logLabel ?? (isFromOfficialRobloxCatalogQuery ? 'official' : 'limited');
	processPageCount[logKey] = (processPageCount[logKey] ?? 0) + 1;
	const pageNum = processPageCount[logKey];
	if (newItems.length === 0) {
		await logger.log(`🔄 Roblox catalog [${logKey}] page ${pageNum}: 0 new items (skipped)`);
		return;
	}
	await logger.log(`🔄 Roblox catalog [${logKey}] page ${pageNum}: ${newItems.length} new items (total seen: ${seen.size})`);

	const snapshots = newItems.map(toSnapshot);
	const todayUtcDay = utcCalendarDayMinusDays(0);
	const announceDay = isAllowCatalogFirstMessage ? todayUtcDay : null;

	const perServerChanges = new Map<number, Map<bigint, RobloxItemChange[]>>();
	const perServerUnposted = new Map<number, Set<bigint>>();

	for (const target of targets) {
		await db.syncServerRobloxItemsFromApi(officialBotId, target.serverId, snapshots);

		const announceItems = announceDay ? newItems.filter((x) => x.itemCreatedUtc && utcDay(x.itemCreatedUtc) === announceDay) : [];
		const unposted =
			announceItems.length > 0
				? new Set(
						await db.listServerRobloxUnpostedAssetIds(
							target.serverId,
							announceItems.map((x) => catalogAssetBi(x))
						)
					)
				: new Set<bigint>();
		perServerUnposted.set(target.serverId, unposted);

		const changes = await db.detectAndUpdateServerRobloxItemChanges(target.serverId, snapshots);
		perServerChanges.set(target.serverId, changes);
	}

	await db.updateBotRobloxItemLastValues(snapshots);

	for (const target of targets) {
		const unposted = perServerUnposted.get(target.serverId) ?? new Set<bigint>();
		const changes = perServerChanges.get(target.serverId) ?? new Map<bigint, RobloxItemChange[]>();

		for (const item of sortItemsByCreatedOldestFirst(newItems)) {
			const aid = catalogAssetBi(item);
			const isNew = unposted.has(aid);
			const itemChanges = changes.get(aid) ?? [];
			if (!isNew && itemChanges.length === 0) {
				continue;
			}

			try {
				await sendItemEmbed(target, item, { isNew, changes: itemChanges, fromOfficialRobloxCatalogQuery: isFromOfficialRobloxCatalogQuery });

				if (isNew) {
					await db.markServerRobloxItemMessagePosted(target.serverId, aid);
					await logger.log(`🛍️ Roblox catalog: posted item ${item.id} → ${target.channelId}`);
				} else {
					await logger.log(`🔄 Roblox catalog: updated item ${item.id} → ${target.channelId}: ${itemChanges.map((c) => c.field).join(', ')}`);
				}
			} catch (err) {
				await logger.log(`❌ Roblox catalog: failed to post item ${item.id} for server ${target.serverId}: ${(err as Error)?.message || err}`);
			}
		}
	}
}

let lastNotificationPassAt = 0;

async function runNotificationPriorityPass(officialBotId: number, targets: ServerTarget[]) {
	const watched = await db.listNotifiedRobloxItemsForBot(officialBotId, ROBLOX_CATALOG_NOTIFICATION_MAX_ASSETS).catch(() => []);
	if (watched.length === 0) {
		return;
	}

	const refs: RobloxCatalogItemRef[] = [];
	const knownThumbnails = new Map<number, string | null>();
	for (const row of watched) {
		const id = Number(row.assetId);
		if (!Number.isSafeInteger(id)) {
			continue;
		}
		refs.push({ id, itemType: row.assetType == null ? 'Bundle' : 'Asset' });
		knownThumbnails.set(id, row.thumbnailUrl);
	}
	if (refs.length === 0) {
		return;
	}

	const items = await fetchCatalogItemsByRefs(refs, knownThumbnails);
	if (items.length === 0) {
		return;
	}

	await processPage(officialBotId, targets, {
		items,
		seen: new Set<bigint>(),
		fromOfficialRobloxCatalogQuery: false,
		allowCatalogFirstMessage: false,
		logLabel: 'notification'
	});
}

async function maybeRunNotificationPriorityPass(officialBotId: number, targets: ServerTarget[]) {
	if (Date.now() - lastNotificationPassAt < ROBLOX_CATALOG_NOTIFICATION_INTERVAL_MS) {
		return;
	}
	await forceNotificationPriorityPass(officialBotId, targets);
}

async function forceNotificationPriorityPass(officialBotId: number, targets: ServerTarget[]) {
	lastNotificationPassAt = Date.now();
	await runNotificationPriorityPass(officialBotId, targets).catch((err) =>
		logger.log(`⚠️ Roblox catalog: notification priority pass error: ${err?.message || err}`)
	);
}

async function backgroundSync(officialBotId: number, targets: ServerTarget[], seen: Set<bigint>) {
	await logger.log('🛍️ Roblox catalog: starting background sync...');

	const pollOrder = shuffledCatalogPollOrder();
	for (let i = 0; i < pollOrder.length; i++) {
		if (i > 0) {
			await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_POLL_MS));
		}
		const stream = robloxCatalogStreams[pollOrder[i]];
		await streamCatalogPages(stream.params, async (items) => {
			await maybeRunNotificationPriorityPass(officialBotId, targets);
			await processPage(officialBotId, targets, {
				items,
				seen,
				fromOfficialRobloxCatalogQuery: stream.useOfficialCatalogEmbedStyle,
				allowCatalogFirstMessage: false
			});
		});
	}

	await logger.log('🛍️ Roblox catalog: background sync complete');
}

async function runTick(client: Client, officialBotId: number) {
	if (isTickRunning) {
		return;
	}
	isTickRunning = true;
	try {
		const targets = await getActiveServers(client, officialBotId);
		if (targets.length === 0) {
			return;
		}

		const isEmpty = await db.isBotRobloxItemsEmpty(officialBotId);
		if (isEmpty) {
			await initialSeed(officialBotId, targets);
			return;
		}

		const seen = new Set<bigint>();
		processPageCount = {};

		await forceNotificationPriorityPass(officialBotId, targets);

		const pollOrder = shuffledCatalogPollOrder();
		for (let i = 0; i < pollOrder.length; i++) {
			if (i > 0) {
				await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_POLL_MS));
			}
			const stream = robloxCatalogStreams[pollOrder[i]];
			await streamCatalogPages(stream.params, async (items) => {
				await maybeRunNotificationPriorityPass(officialBotId, targets);
				await processPage(officialBotId, targets, {
					items,
					seen,
					fromOfficialRobloxCatalogQuery: stream.useOfficialCatalogEmbedStyle,
					allowCatalogFirstMessage: true
				});
			});
		}
	} finally {
		isTickRunning = false;
	}
}

function scheduleNextTick(client: Client, officialBotId: number) {
	tickTimeoutRef = setTimeout(() => {
		runTick(client, officialBotId)
			.catch((err) => logger.log(`❌ Roblox catalog tick error: ${err?.message || err}`))
			.finally(() => scheduleNextTick(client, officialBotId));
	}, ROBLOX_CATALOG_POLL_MS);
}

export function initRobloxCatalogNotifier(client: Client, officialBotId: number | null) {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
	if (!officialBotId) {
		logger.log('Roblox catalog notifier: no official bot id, skipping');
		return;
	}
	runTick(client, officialBotId).catch((err) => logger.log(`❌ Roblox catalog tick error: ${err?.message || err}`));
	scheduleNextTick(client, officialBotId);
}

export function stopRobloxCatalogNotifier() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

export function isRobloxItemNotificationButtonId(customId: string): boolean {
	return customId.startsWith(ROBLOX_ITEM_NOTIFICATION_BUTTON_PREFIX);
}

export function isRobloxItemNotificationTypesSelectId(customId: string): boolean {
	return customId.startsWith(ROBLOX_ITEM_NOTIFICATION_TYPES_SELECT_PREFIX);
}

function assetIdFromCustomId(customId: string, prefix: string): bigint | null {
	const raw = customId.slice(prefix.length).split(':')[0].trim();
	if (!/^\d+$/.test(raw)) {
		return null;
	}
	try {
		return BigInt(raw);
	} catch {
		return null;
	}
}

function sanitizeNotificationTypes(values: string[]): RobloxNotificationType[] {
	const allowed = new Set<string>(ROBLOX_NOTIFICATION_TYPES);
	return Array.from(new Set(values.filter((v) => allowed.has(v)))) as RobloxNotificationType[];
}

async function notificationTypeLabel(type: RobloxNotificationType, guildId: string, userId: string): Promise<string> {
	return await translate(`robloxCatalog.notifications.types.${type}.label`, { guildId, userId });
}

async function formatActiveTypes(types: string[], guildId: string, userId: string): Promise<string> {
	const valid = sanitizeNotificationTypes(types);
	if (valid.length === 0) {
		return await translate('robloxCatalog.notifications.noTypes', { guildId, userId });
	}
	const labels = await Promise.all(valid.map(async (t) => `${ROBLOX_NOTIFICATION_TYPE_EMOJI[t]} ${await notificationTypeLabel(t, guildId, userId)}`));
	return labels.join(', ');
}

async function resolveMemberContext(guildId: string, discordUserId: string) {
	const server = await getServerForCurrentBot(guildId).catch(() => null);
	if (!server) {
		return null;
	}
	const member = await db.getMemberByDiscordId(server.id, discordUserId).catch(() => null);
	if (!member) {
		return null;
	}
	return { server, member };
}

type ItemTypesView = { item: { id: number; asset_id: bigint; name: string | null }; selectedTypes: string[]; fromMenu: boolean; statusLine?: string };

async function buildItemTypesPayload(guildId: string, userId: string, { item, selectedTypes, fromMenu: isFromMenu, statusLine }: ItemTypesView) {
	const embedConfig = await getEmbedConfig(guildId);
	const itemName = item.name?.trim() || (await translate('robloxCatalog.itemFallback', { guildId, userId }, { id: item.asset_id.toString() }));
	const selected = sanitizeNotificationTypes(selectedTypes);

	const title = await translate('robloxCatalog.notifications.item.title', { guildId, userId });
	const description = await translate(
		'robloxCatalog.notifications.item.description',
		{ guildId, userId },
		{
			item: itemName,
			url: robloxCatalogItemUrl(Number(item.asset_id))
		}
	);
	const activeLabel = await translate(
		'robloxCatalog.notifications.item.active',
		{ guildId, userId },
		{
			types: await formatActiveTypes(selected, guildId, userId)
		}
	);

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(title)
		.setDescription([description, activeLabel, statusLine].filter(Boolean).join('\n\n').slice(0, DISCORD_LIMITS.EMBED_DESCRIPTION))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const options = await Promise.all(
		ROBLOX_NOTIFICATION_TYPES.map(async (type) => ({
			label: (await notificationTypeLabel(type, guildId, userId)).slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
			value: type,
			description: (await translate(`robloxCatalog.notifications.types.${type}.description`, { guildId, userId })).slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT),
			emoji: ROBLOX_NOTIFICATION_TYPE_EMOJI[type],
			default: selected.includes(type)
		}))
	);

	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`${ROBLOX_ITEM_NOTIFICATION_TYPES_SELECT_PREFIX}${item.asset_id.toString()}${isFromMenu ? ':menu' : ''}`)
		.setPlaceholder((await translate('robloxCatalog.notifications.item.placeholder', { guildId, userId })).slice(0, DISCORD_LIMITS.SELECT_PLACEHOLDER))
		.setMinValues(0)
		.setMaxValues(options.length)
		.addOptions(options);

	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu)];

	if (isFromMenu) {
		rows.push(
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(ROBLOX_NOTIFICATIONS_MENU_BUTTON_ID)
					.setLabel(await translate('menu.back', { guildId, userId }))
					.setStyle(ButtonStyle.Secondary)
			)
		);
	}

	return { embeds: [embed], components: rows };
}

type NotificationsMenuView = { memberId: number; statusLine?: string };

async function buildRobloxNotificationsMenuPayload(guildId: string, userId: string, { memberId, statusLine }: NotificationsMenuView) {
	const embedConfig = await getEmbedConfig(guildId);
	const subscriptions = await db.listServerMemberRobloxItemNotifications(memberId).catch(() => []);

	const title = await translate('robloxCatalog.notifications.menu.title', { guildId, userId });
	const description =
		subscriptions.length === 0
			? await translate(
					'robloxCatalog.notifications.menu.empty',
					{ guildId, userId },
					{
						button: (await serverTranslator(guildId))('robloxCatalog.post.notifyMe')
					}
				)
			: await translate('robloxCatalog.notifications.menu.description', { guildId, userId }, { count: formatCount(subscriptions.length) });

	const lines = await Promise.all(
		subscriptions.slice(0, MENU_SUBSCRIPTIONS_SHOWN).map(async (sub) => {
			const name = sub.name?.trim() || (await translate('robloxCatalog.itemFallback', { guildId, userId }, { id: sub.assetId.toString() }));
			return `**${name}**\n${await formatActiveTypes(sub.types, guildId, userId)}`;
		})
	);

	const embed = new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(title)
		.setDescription([description, lines.join('\n'), statusLine].filter(Boolean).join('\n\n').slice(0, DISCORD_LIMITS.EMBED_DESCRIPTION))
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();

	const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = [];

	if (subscriptions.length > 0) {
		const options = await Promise.all(
			subscriptions.slice(0, MENU_SUBSCRIPTIONS_SHOWN).map(async (sub) => ({
				label: (sub.name?.trim() || (await translate('robloxCatalog.itemFallback', { guildId, userId }, { id: sub.assetId.toString() }))).slice(
					0,
					DISCORD_LIMITS.SELECT_OPTION_TEXT
				),
				value: sub.assetId.toString(),
				description: (await formatActiveTypes(sub.types, guildId, userId)).slice(0, DISCORD_LIMITS.SELECT_OPTION_TEXT)
			}))
		);

		rows.push(
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId(ROBLOX_NOTIFICATIONS_SELECT_ID)
					.setPlaceholder((await translate('robloxCatalog.notifications.menu.placeholder', { guildId, userId })).slice(0, DISCORD_LIMITS.SELECT_PLACEHOLDER))
					.setMinValues(1)
					.setMaxValues(1)
					.addOptions(options)
			)
		);
	}

	const buttons = [
		new ButtonBuilder()
			.setCustomId('bot_notifications')
			.setLabel(await translate('menu.back', { guildId, userId }))
			.setStyle(ButtonStyle.Secondary)
	];

	if (subscriptions.length > 0) {
		buttons.unshift(
			new ButtonBuilder()
				.setCustomId(ROBLOX_NOTIFICATIONS_DISABLE_ALL_BUTTON_ID)
				.setLabel(await translate('robloxCatalog.notifications.menu.disableAll', { guildId, userId }))
				.setStyle(ButtonStyle.Danger)
		);
	}

	rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons));

	return { embeds: [embed], components: rows };
}

type EphemeralPayload = { content?: string; embeds?: EmbedBuilder[]; components?: ActionRowBuilder<MessageActionRowComponentBuilder>[] };

async function respondEphemeral(interaction: ButtonInteraction | StringSelectMenuInteraction, payload: EphemeralPayload) {
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload).catch(() => null);
		return;
	}
	await interaction.update(payload).catch(() => interaction.reply({ ...payload, flags: MessageFlags.Ephemeral }).catch(() => null));
}

export async function handleRobloxItemNotificationButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) {
		return;
	}

	const assetId = assetIdFromCustomId(interaction.customId, ROBLOX_ITEM_NOTIFICATION_BUTTON_PREFIX);
	if (assetId == null) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	await interaction.deferReply({ flags: MessageFlags.Ephemeral });

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) {
		const message = await translate('robloxCatalog.notifications.errors.memberNotFound', { guildId, userId: interaction.user.id });
		await interaction.editReply({ content: message }).catch(() => null);
		return;
	}

	const item = await db.getBotRobloxItemByAssetId(assetId).catch(() => null);
	if (!item) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.editReply({ content: message }).catch(() => null);
		return;
	}

	const currentTypes = await db.getServerMemberRobloxItemNotificationTypes(context.member.id, item.id).catch(() => [] as string[]);
	const payload = await buildItemTypesPayload(guildId, interaction.user.id, { item, selectedTypes: currentTypes, fromMenu: false });
	await interaction.editReply(payload).catch(() => null);
}

export async function handleRobloxItemNotificationTypesSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) {
		return;
	}

	const assetId = assetIdFromCustomId(interaction.customId, ROBLOX_ITEM_NOTIFICATION_TYPES_SELECT_PREFIX);
	const isFromMenu = interaction.customId.endsWith(':menu');
	if (assetId == null) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) {
		const message = await translate('robloxCatalog.notifications.errors.memberNotFound', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const item = await db.getBotRobloxItemByAssetId(assetId).catch(() => null);
	if (!item) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const types = sanitizeNotificationTypes(interaction.values || []);
	const action = await db.setServerMemberRobloxItemNotificationTypes(context.member.id, item.id, types);
	const itemName = item.name?.trim() || (await translate('robloxCatalog.itemFallback', { guildId, userId: interaction.user.id }, { id: assetId.toString() }));
	const watchers = await db.countServerRobloxItemNotifications(context.server.id, item.id).catch(() => 0);

	const statusLine = await translate(
		action === 'removed' ? 'robloxCatalog.notifications.removed' : 'robloxCatalog.notifications.saved',
		{ guildId, userId: interaction.user.id },
		{
			item: itemName,
			types: await formatActiveTypes(types, guildId, interaction.user.id),
			count: formatCount(watchers)
		}
	);

	const payload = await buildItemTypesPayload(guildId, interaction.user.id, { item, selectedTypes: types, fromMenu: isFromMenu, statusLine });
	await respondEphemeral(interaction, payload);

	await logger.log(
		`🔔 Roblox catalog: ${interaction.user.tag} ${action} notification types [${types.join(', ')}] for asset ${assetId.toString()} (${watchers} watching)`
	);
}

export async function handleRobloxNotificationsMenuButton(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) {
		return;
	}

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) {
		const message = await translate('robloxCatalog.notifications.errors.memberNotFound', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const payload = await buildRobloxNotificationsMenuPayload(guildId, interaction.user.id, { memberId: context.member.id });
	await respondEphemeral(interaction, payload);
}

export async function handleRobloxNotificationsSelect(interaction: StringSelectMenuInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) {
		return;
	}

	const raw = (interaction.values || [])[0] || '';
	if (!/^\d+$/.test(raw)) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) {
		const message = await translate('robloxCatalog.notifications.errors.memberNotFound', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const item = await db.getBotRobloxItemByAssetId(BigInt(raw)).catch(() => null);
	if (!item) {
		const message = await translate('robloxCatalog.notifications.errors.invalidItem', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const currentTypes = await db.getServerMemberRobloxItemNotificationTypes(context.member.id, item.id).catch(() => [] as string[]);
	const payload = await buildItemTypesPayload(guildId, interaction.user.id, { item, selectedTypes: currentTypes, fromMenu: true });
	await respondEphemeral(interaction, payload);
}

export async function handleRobloxNotificationsDisableAll(interaction: ButtonInteraction): Promise<void> {
	const guildId = interaction.guild?.id;
	if (!guildId) {
		return;
	}

	const context = await resolveMemberContext(guildId, interaction.user.id);
	if (!context) {
		const message = await translate('robloxCatalog.notifications.errors.memberNotFound', { guildId, userId: interaction.user.id });
		await interaction.reply({ content: message, flags: MessageFlags.Ephemeral }).catch(() => null);
		return;
	}

	const cleared = await db.clearServerMemberRobloxItemNotifications(context.member.id).catch(() => 0);
	const statusLine = await translate('robloxCatalog.notifications.menu.disabledAll', { guildId, userId: interaction.user.id }, { count: formatCount(cleared) });
	const payload = await buildRobloxNotificationsMenuPayload(guildId, interaction.user.id, { memberId: context.member.id, statusLine });
	await respondEphemeral(interaction, payload);

	await logger.log(`🔕 Roblox catalog: ${interaction.user.tag} disabled all ${cleared} item notifications`);
}
