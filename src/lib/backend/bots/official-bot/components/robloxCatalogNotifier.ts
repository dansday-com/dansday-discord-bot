import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db, { type RobloxItemChange } from '../../../../database.js';
import { getEmbedConfig, getMainChannel, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { assetTypeCategory, fetchCatalogFirstPage, RobloxCatalogItem, robloxCatalogItemUrl, streamCatalogPages } from '../../../api/roblox-catalog-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;

const POLL_MS = 60_000;

const groupedInteger = new Intl.NumberFormat('id-ID');

function formatRobux(n: number): string {
	return n === 0 ? 'FREE' : `${groupedInteger.format(Math.trunc(n))} Robux`;
}

function formatCount(n: number): string {
	return groupedInteger.format(Math.trunc(n));
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
		name: x.name ?? null,
		description: x.description ?? null,
		creatorName: x.creatorName ?? null,
		price: x.price ?? null,
		lowestPrice: x.lowestPrice ?? null,
		lowestResalePrice: x.lowestResalePrice ?? null,
		totalQuantity: x.totalQuantity ?? null,
		thumbnailUrl: x.thumbnailUrl ?? null,
		itemUrl: robloxCatalogItemUrl(x.id),
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

function resolveAnnounceDay(items: RobloxCatalogItem[]): string | null {
	const daySet = new Set<string>();
	for (const x of items) {
		if (x.itemCreatedUtc) daySet.add(utcDay(x.itemCreatedUtc));
	}
	if (daySet.size === 0) return null;
	const today = utcCalendarDayMinusDays(0);
	if (daySet.has(today)) return today;
	return [...daySet].sort((a, b) => b.localeCompare(a))[0] ?? null;
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
		if (!channelId) {
			try {
				channelId = await getMainChannel(guildId);
			} catch {
				channelId = '';
			}
		}
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

async function sendItemEmbed(target: ServerTarget, item: RobloxCatalogItem, isNew: boolean, changeLines?: string) {
	const url = robloxCatalogItemUrl(item.id);
	const price = typeof item.price === 'number' ? formatRobux(item.price) : '—';
	const lowestPrice = typeof item.lowestPrice === 'number' ? formatRobux(item.lowestPrice) : '—';
	const lowestResale = typeof item.lowestResalePrice === 'number' ? formatRobux(item.lowestResalePrice) : '—';
	const quantity = typeof item.totalQuantity === 'number' ? formatCount(item.totalQuantity) : '—';
	const category = assetTypeCategory(item.assetType) ?? '—';
	const createdAt = item.itemCreatedUtc ? `<t:${Math.floor(new Date(item.itemCreatedUtc).getTime() / 1000)}:D>` : '—';

	const title = isNew ? (item.name || `Item #${item.id}`).slice(0, 256) : `[Updated] ${item.name || `Item #${item.id}`}`.slice(0, 256);

	const color = changeLines ? 0xffc107 : item.creatorHasVerifiedBadge ? 0x57f287 : target.embedConfig.COLOR;

	const embed = new EmbedBuilder()
		.setColor(color)
		.setTitle(title)
		.addFields(
			{ name: 'Category', value: category, inline: true },
			{ name: 'Price', value: price, inline: true },
			{ name: 'Creator', value: (item.creatorHasVerifiedBadge ? `✅ ${item.creatorName}` : item.creatorName || '—').slice(0, 1024), inline: true },
			{ name: 'Lowest Price', value: lowestPrice, inline: true },
			{ name: 'Lowest Resale', value: lowestResale, inline: true },
			{ name: 'Total Quantity', value: quantity, inline: true },
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

	await target.channel.send({ embeds: [embed], components: [btnRow] });
}

async function initialSeed(client: Client, officialBotId: number, targets: ServerTarget[]) {
	await logger.log('🛍️ Roblox catalog: DB empty, performing initial seed...');

	const [robloxItems, limitedItems] = await Promise.all([
		fetchCatalogFirstPage({ CreatorType: 1, CreatorTargetId: 1, SortType: 3 }),
		fetchCatalogFirstPage({ SalesTypeFilter: 2, SortType: 3 })
	]);

	const seenIds = new Set<number>();
	const all: RobloxCatalogItem[] = [];
	for (const item of [...robloxItems, ...limitedItems]) {
		if (seenIds.has(item.id)) continue;
		seenIds.add(item.id);
		all.push(item);
	}

	const announceDay = resolveAnnounceDay(all);
	const toPost = announceDay
		? all
				.filter((x) => x.itemCreatedUtc && utcDay(x.itemCreatedUtc) === announceDay)
				.sort((a, b) => new Date(a.itemCreatedUtc!).getTime() - new Date(b.itemCreatedUtc!).getTime())
		: [];

	await logger.log(`🛍️ Roblox catalog: seed found ${all.length} total, posting ${toPost.length} first-announce items (${announceDay ?? 'no dated items'} UTC)`);

	for (const target of targets) {
		await db.syncServerRobloxItemsFromApi(officialBotId, target.serverId, all.map(toSnapshot));

		const unposted = new Set(
			await db.listServerRobloxUnpostedAssetIds(
				target.serverId,
				toPost.map((x) => x.id)
			)
		);

		for (const item of toPost) {
			if (!unposted.has(item.id)) continue;
			try {
				await sendItemEmbed(target, item, true);
				await db.markServerRobloxItemMessagePosted(target.serverId, item.id);
				await logger.log(`🛍️ Roblox catalog: seeded item ${item.id} → ${target.channelId}`);
			} catch (err: any) {
				await logger.log(`❌ Roblox catalog: failed to seed item ${item.id}: ${err?.message || err}`);
			}
		}
	}

	backgroundSync(officialBotId, targets, seenIds).catch((err) => logger.log(`⚠️ Roblox catalog: background sync error: ${err?.message || err}`));
}

let processPageCount: Record<string, number> = {};

async function processPage(officialBotId: number, targets: ServerTarget[], items: RobloxCatalogItem[], seen: Set<number>, source: string) {
	const newItems = items.filter((x) => !seen.has(x.id));
	for (const x of newItems) seen.add(x.id);
	processPageCount[source] = (processPageCount[source] ?? 0) + 1;
	const pageNum = processPageCount[source];
	if (newItems.length === 0) {
		await logger.log(`🔄 Roblox catalog [${source}] page ${pageNum}: 0 new items (skipped)`);
		return;
	}
	await logger.log(`🔄 Roblox catalog [${source}] page ${pageNum}: ${newItems.length} new items (total seen: ${seen.size})`);

	const snapshots = newItems.map(toSnapshot);
	const announceDay = resolveAnnounceDay(newItems);

	const perServerChanges = new Map<number, Map<number, RobloxItemChange[]>>();
	const perServerUnposted = new Map<number, Set<number>>();

	for (const target of targets) {
		await db.syncServerRobloxItemsFromApi(officialBotId, target.serverId, snapshots);

		const announceItems = announceDay ? newItems.filter((x) => x.itemCreatedUtc && utcDay(x.itemCreatedUtc) === announceDay) : [];
		const unposted =
			announceItems.length > 0
				? new Set(
						await db.listServerRobloxUnpostedAssetIds(
							target.serverId,
							announceItems.map((x) => x.id)
						)
					)
				: new Set<number>();
		perServerUnposted.set(target.serverId, unposted);

		const changes = await db.detectAndUpdateServerRobloxItemChanges(target.serverId, snapshots);
		perServerChanges.set(target.serverId, changes);
	}

	await db.updateBotRobloxItemLastValues(snapshots);

	for (const target of targets) {
		const unposted = perServerUnposted.get(target.serverId) ?? new Set<number>();
		const changes = perServerChanges.get(target.serverId) ?? new Map<number, RobloxItemChange[]>();

		for (const item of newItems) {
			const isNew = unposted.has(item.id);
			const itemChanges = changes.get(item.id) ?? [];
			if (!isNew && itemChanges.length === 0) continue;

			try {
				let changeLines: string | undefined;
				if (!isNew && itemChanges.length > 0) {
					changeLines = itemChanges
						.map((c) => {
							const label =
								c.field === 'total_quantity'
									? 'Stock'
									: c.field === 'lowest_price'
										? 'Lowest Price'
										: c.field === 'lowest_resale_price'
											? 'Lowest Resale'
											: 'Price';
							const isPrice = c.field !== 'total_quantity';
							const fmt = (v: number | null) => (v == null ? '—' : isPrice ? formatRobux(v) : formatCount(v));
							return `**${label}**: ${fmt(c.oldValue)} → ${fmt(c.newValue)}`;
						})
						.join('\n');
				}

				await sendItemEmbed(target, item, isNew, changeLines);

				if (isNew) {
					await db.markServerRobloxItemMessagePosted(target.serverId, item.id);
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

async function backgroundSync(officialBotId: number, targets: ServerTarget[], seen: Set<number>) {
	await logger.log('🛍️ Roblox catalog: starting background sync...');

	await streamCatalogPages({ CreatorType: 1, CreatorTargetId: 1, SortType: 3 }, async (items) => {
		await processPage(officialBotId, targets, items, seen, 'roblox-official');
	});
	await new Promise((r) => setTimeout(r, 10_000));
	await streamCatalogPages({ SalesTypeFilter: 2, SortType: 3 }, async (items) => {
		await processPage(officialBotId, targets, items, seen, 'limiteds');
	});

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
			await initialSeed(client, officialBotId, targets);
			return;
		}

		const seen = new Set<number>();
		processPageCount = {};

		await streamCatalogPages({ CreatorType: 1, CreatorTargetId: 1, SortType: 3 }, async (items) => {
			await processPage(officialBotId, targets, items, seen, 'roblox-official');
		});

		await new Promise((r) => setTimeout(r, 10_000));

		await streamCatalogPages({ SalesTypeFilter: 2, SortType: 3 }, async (items) => {
			await processPage(officialBotId, targets, items, seen, 'limiteds');
		});
	} finally {
		tickRunning = false;
	}
}

function scheduleNextTick(client: Client, officialBotId: number) {
	tickTimeoutRef = setTimeout(() => {
		runTick(client, officialBotId)
			.catch((err) => logger.log(`❌ Roblox catalog tick error: ${err?.message || err}`))
			.finally(() => scheduleNextTick(client, officialBotId));
	}, POLL_MS);
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

export default { initRobloxCatalogNotifier, stopRobloxCatalogNotifier };
