import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import { randomInt } from 'node:crypto';
import db, { snapshotBigIntOrNull, type RobloxItemChange } from '../../../../database.js';
import {
	fetchCatalogFirstPage,
	getEmbedConfig,
	isComponentFeatureEnabled,
	PERMISSIONS,
	robloxCatalogEmbedColors,
	robloxCatalogItemUrl,
	robloxCatalogStreams,
	robloxCatalogStreamPollOrder,
	ROBLOX_CATALOG_POLL_MS,
	serverSettingsComponent,
	streamCatalogPages,
	NOTIFICATIONS,
	type RobloxCatalogItem
} from '../../../config.js';
import { logger } from '../../../../utils/index.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;

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
	const id = item.id;
	if (typeof id !== 'number' || !Number.isInteger(id) || !Number.isFinite(id)) {
		throw new Error(`[roblox-catalog-notifier] invalid asset id (expected finite integer): ${String(id)}`);
	}
	return BigInt(id);
}

function isOfficialRobloxAccount(item: RobloxCatalogItem): boolean {
	if (item.creatorTargetId !== 1) return false;
	const ct = (item.creatorType ?? '').trim().toLowerCase();
	return ct === '' || ct === 'user' || ct === '1';
}

const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function formatRobux(n: number | bigint): string {
	const b = typeof n === 'bigint' ? n : BigInt(Math.trunc(Number(n)));
	if (b === 0n) return 'FREE';
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
	if (u != null && t != null) return `${formatCount(u)}/${formatCount(t)}`;
	if (u != null) return `${formatCount(u)}/—`;
	if (t != null) return `—/${formatCount(t)}`;
	return '—';
}

type ServerTarget = {
	serverId: number;
	guildId: string;
	channelId: string;
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>;
	channel: any;
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
	return new Date(utcStr).toISOString().slice(0, 10);
}

function utcCalendarDayMinusDays(offsetDays: number): string {
	const d = new Date();
	const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offsetDays);
	return new Date(t).toISOString().slice(0, 10);
}

function announceDayFromMergedFirstPages(items: RobloxCatalogItem[]): string | null {
	const daySet = new Set<string>();
	for (const x of items) {
		if (x.itemCreatedUtc) daySet.add(utcDay(x.itemCreatedUtc));
	}
	if (daySet.size === 0) return null;
	const today = utcCalendarDayMinusDays(0);
	if (daySet.has(today)) return today;
	const winTs = maxItemCreatedTs(items);
	if (winTs > 0) return utcDay(new Date(winTs).toISOString());
	return [...daySet].sort((a, b) => b.localeCompare(a))[0] ?? null;
}

function maxItemCreatedTs(items: RobloxCatalogItem[]): number {
	let m = 0;
	for (const x of items) {
		if (!x.itemCreatedUtc) continue;
		const t = new Date(x.itemCreatedUtc).getTime();
		if (Number.isFinite(t) && t > m) m = t;
	}
	return m;
}

function sortItemsByCreatedOldestFirst(items: RobloxCatalogItem[]): RobloxCatalogItem[] {
	return [...items].sort((a, b) => {
		const at = a.itemCreatedUtc ? new Date(a.itemCreatedUtc).getTime() : Number.POSITIVE_INFINITY;
		const bt = b.itemCreatedUtc ? new Date(b.itemCreatedUtc).getTime() : Number.POSITIVE_INFINITY;
		if (at !== bt) return at - bt;
		return a.id - b.id;
	});
}

async function getActiveServers(client: Client, officialBotId: number): Promise<ServerTarget[]> {
	const servers = await db.getServersForBot(officialBotId);
	const targets: ServerTarget[] = [];

	for (const server of servers) {
		const guildId = server.discord_server_id;
		if (!guildId) continue;
		if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.roblox_catalog_notifier))) continue;

		const row = await db.getServerSettings(server.id, serverSettingsComponent.roblox_catalog_notifier).catch(() => null);
		const s = row && !Array.isArray(row) && typeof row.settings === 'object' ? (row.settings as Record<string, unknown>) : {};

		let channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) continue;

		const guild = await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) continue;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) continue;

		const embedConfig = await getEmbedConfig(guildId);
		targets.push({ serverId: server.id, guildId, channelId, embedConfig, channel });
	}

	return targets;
}

async function sendItemEmbed(
	target: ServerTarget,
	item: RobloxCatalogItem,
	isNew: boolean,
	changeLines: string | undefined,
	fromOfficialRobloxCatalogQuery: boolean
) {
	const isOfficial = isOfficialRobloxAccount(item) || fromOfficialRobloxCatalogQuery;
	const isNewOfficial = isNew && isOfficial;
	const url = robloxCatalogItemUrl(item.id);
	const price = typeof item.price === 'number' ? formatRobux(item.price) : '—';
	const quantity = formatQuantityRatio(item);
	const category = item.category?.trim() || '—';
	const favorites = typeof item.favoriteCount === 'number' ? formatCount(item.favoriteCount) : '—';
	const createdAt = item.itemCreatedUtc ? `<t:${Math.floor(new Date(item.itemCreatedUtc).getTime() / 1000)}:D>` : '—';

	const resaleOrSaleFields: { name: string; value: string; inline: boolean }[] = [];
	if (item.hasResellers && typeof item.lowestResalePrice === 'number') {
		resaleOrSaleFields.push({
			name: 'Lowest Resale',
			value: formatRobux(item.lowestResalePrice),
			inline: true
		});
	} else if (item.offSaleDeadline) {
		const ts = Math.floor(new Date(item.offSaleDeadline).getTime() / 1000);
		if (Number.isFinite(ts)) {
			resaleOrSaleFields.push({ name: 'Sale ends', value: `<t:${ts}:F>`, inline: true });
		}
	}

	const title = isNew ? (item.name || `Item #${item.id}`).slice(0, 256) : `[Updated] ${item.name || `Item #${item.id}`}`.slice(0, 256);

	const embed = new EmbedBuilder()
		.setColor(
			isNewOfficial
				? 0xffd700
				: isOfficial
					? robloxCatalogEmbedColors.fromOfficialQuery
					: changeLines
						? robloxCatalogEmbedColors.itemUpdated
						: target.embedConfig.COLOR
		)
		.setTitle(title)
		.addFields(
			{ name: 'Category', value: category.slice(0, 1024), inline: true },
			{ name: 'Price', value: price, inline: true },
			{ name: 'Creator', value: (item.creatorHasVerifiedBadge ? `✅ ${item.creatorName}` : item.creatorName || '—').slice(0, 1024), inline: true },
			{ name: 'Quantity', value: quantity, inline: true },
			{ name: 'Favorites', value: favorites, inline: true },
			...resaleOrSaleFields,
			{ name: 'Created', value: createdAt, inline: true }
		)
		.setFooter({ text: target.embedConfig.FOOTER });

	if (changeLines) {
		embed.setDescription(changeLines.slice(0, 4096));
	} else if (item.description?.trim()) {
		embed.setDescription(item.description.trim().slice(0, 4096));
	}
	if (item.thumbnailUrl?.startsWith('http')) embed.setThumbnail(item.thumbnailUrl);

	const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Open on Roblox').setEmoji('🛍️')
	);

	const parts: string[] = [];

	const notificationMentions = await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(target.guildId, target.channel.id).catch(() => null);
	if (notificationMentions && notificationMentions.length > 0) parts.push(notificationMentions[0]);

	const content = parts.length > 0 ? parts.join(' ') : undefined;

	await target.channel.send({ content, embeds: [embed], components: [btnRow] });

	if (notificationMentions && notificationMentions.length > 1) {
		for (let i = 1; i < notificationMentions.length; i++) {
			await target.channel.send({ content: notificationMentions[i] }).catch(() => null);
		}
	}
}

async function initialSeed(officialBotId: number, targets: ServerTarget[]) {
	await logger.log('🛍️ Roblox catalog: DB empty, performing initial seed...');

	const pollOrder = shuffledCatalogPollOrder();
	const firstPageResults = await Promise.all(pollOrder.map((key) => fetchCatalogFirstPage(robloxCatalogStreams[key].params)));

	const assetIdsFromOfficialQuery = new Set<bigint>();
	for (let i = 0; i < pollOrder.length; i++) {
		if (robloxCatalogStreams[pollOrder[i]].useOfficialCatalogEmbedStyle) {
			for (const item of firstPageResults[i]) assetIdsFromOfficialQuery.add(catalogAssetBi(item));
		}
	}

	const seenIds = new Set<bigint>();
	const all: RobloxCatalogItem[] = [];
	for (const items of firstPageResults) {
		for (const item of items) {
			const aid = catalogAssetBi(item);
			if (seenIds.has(aid)) continue;
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
			if (!unposted.has(catalogAssetBi(item))) continue;
			try {
				await sendItemEmbed(target, item, true, undefined, assetIdsFromOfficialQuery.has(catalogAssetBi(item)));
				await db.markServerRobloxItemMessagePosted(target.serverId, catalogAssetBi(item));
				await logger.log(`🛍️ Roblox catalog: seeded item ${item.id} → ${target.channelId}`);
			} catch (err: any) {
				await logger.log(`❌ Roblox catalog: failed to seed item ${item.id}: ${err?.message || err}`);
			}
		}
	}

	backgroundSync(officialBotId, targets, seenIds).catch((err) => logger.log(`⚠️ Roblox catalog: background sync error: ${err?.message || err}`));
}

let processPageCount: Record<string, number> = {};

async function processPage(
	officialBotId: number,
	targets: ServerTarget[],
	items: RobloxCatalogItem[],
	seen: Set<bigint>,
	fromOfficialRobloxCatalogQuery: boolean,
	allowCatalogFirstMessage: boolean
) {
	const newItems = items.filter((x) => !seen.has(catalogAssetBi(x)));
	for (const x of newItems) seen.add(catalogAssetBi(x));
	const logKey = fromOfficialRobloxCatalogQuery ? 'official' : 'limited';
	processPageCount[logKey] = (processPageCount[logKey] ?? 0) + 1;
	const pageNum = processPageCount[logKey];
	if (newItems.length === 0) {
		await logger.log(`🔄 Roblox catalog [${logKey}] page ${pageNum}: 0 new items (skipped)`);
		return;
	}
	await logger.log(`🔄 Roblox catalog [${logKey}] page ${pageNum}: ${newItems.length} new items (total seen: ${seen.size})`);

	const snapshots = newItems.map(toSnapshot);
	const todayUtcDay = utcCalendarDayMinusDays(0);
	const announceDay = allowCatalogFirstMessage ? todayUtcDay : null;

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
			if (!isNew && itemChanges.length === 0) continue;

			try {
				let changeLines: string | undefined;
				if (!isNew && itemChanges.length > 0) {
					changeLines = itemChanges
						.map((c) => {
							const label =
								c.field === 'total_quantity'
									? 'Total supply'
									: c.field === 'units_available'
										? 'Available'
										: c.field === 'lowest_resale_price'
											? 'Lowest Resale'
											: 'Price';
							const isPrice = c.field === 'price' || c.field === 'lowest_resale_price';
							const fmt = (v: bigint | number | null) => (v == null ? '—' : isPrice ? formatRobux(v) : formatCount(v));
							return `**${label}**: ${fmt(c.oldValue)} → ${fmt(c.newValue)}`;
						})
						.join('\n');
				}

				await sendItemEmbed(target, item, isNew, changeLines, fromOfficialRobloxCatalogQuery);

				if (isNew) {
					await db.markServerRobloxItemMessagePosted(target.serverId, aid);
					await logger.log(`🛍️ Roblox catalog: posted item ${item.id} → ${target.channelId}`);
				} else {
					await logger.log(`🔄 Roblox catalog: updated item ${item.id} → ${target.channelId}: ${itemChanges.map((c) => c.field).join(', ')}`);
				}
			} catch (err: any) {
				await logger.log(`❌ Roblox catalog: failed to post item ${item.id} for server ${target.serverId}: ${err?.message || err}`);
			}
		}
	}
}

async function backgroundSync(officialBotId: number, targets: ServerTarget[], seen: Set<bigint>) {
	await logger.log('🛍️ Roblox catalog: starting background sync...');

	const pollOrder = shuffledCatalogPollOrder();
	for (let i = 0; i < pollOrder.length; i++) {
		if (i > 0) await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_POLL_MS));
		const stream = robloxCatalogStreams[pollOrder[i]];
		await streamCatalogPages(stream.params, async (items) => {
			await processPage(officialBotId, targets, items, seen, stream.useOfficialCatalogEmbedStyle, false);
		});
	}

	await logger.log('🛍️ Roblox catalog: background sync complete');
}

async function runTick(client: Client, officialBotId: number) {
	if (tickRunning) return;
	tickRunning = true;
	try {
		const targets = await getActiveServers(client, officialBotId);
		if (targets.length === 0) return;

		const isEmpty = await db.isBotRobloxItemsEmpty(officialBotId);
		if (isEmpty) {
			await initialSeed(officialBotId, targets);
			return;
		}

		const seen = new Set<bigint>();
		processPageCount = {};

		const pollOrder = shuffledCatalogPollOrder();
		for (let i = 0; i < pollOrder.length; i++) {
			if (i > 0) await new Promise((r) => setTimeout(r, ROBLOX_CATALOG_POLL_MS));
			const stream = robloxCatalogStreams[pollOrder[i]];
			await streamCatalogPages(stream.params, async (items) => {
				await processPage(officialBotId, targets, items, seen, stream.useOfficialCatalogEmbedStyle, true);
			});
		}
	} finally {
		tickRunning = false;
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
