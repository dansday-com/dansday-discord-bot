import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { getEmbedConfig, getMainChannel, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { assetTypeCategory, RobloxCatalogItem, robloxCatalogItemUrl, streamCatalogPages } from '../../../../roblox-catalog-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;
let tickRunning = false;

const POLL_MS = 60_000;

type ServerTarget = {
	serverId: number;
	guildId: string;
	channelId: string;
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>;
	guild: Awaited<ReturnType<Client['guilds']['fetch']>>;
	channel: any;
};

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
		targets.push({ serverId: server.id, guildId, channelId, embedConfig, guild, channel });
	}

	return targets;
}

async function processPage(client: Client, officialBotId: number, targets: ServerTarget[], items: RobloxCatalogItem[], seen: Set<number>) {
	const newItems = items.filter((x) => !seen.has(x.id));
	for (const x of newItems) seen.add(x.id);
	if (newItems.length === 0) return;

	const snapshots = newItems.map((x) => ({
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
	}));

	for (const target of targets) {
		await db.syncServerRobloxItemsFromApi(officialBotId, target.serverId, snapshots);

		const assetIds = newItems.map((x) => x.id);
		const unposted = new Set(await db.listServerRobloxUnpostedAssetIds(target.serverId, assetIds));
		if (unposted.size === 0) continue;

		for (const item of newItems) {
			if (!unposted.has(item.id)) continue;
			try {
				const url = robloxCatalogItemUrl(item.id);
				const price = typeof item.price === 'number' ? (item.price === 0 ? 'FREE' : `${item.price} Robux`) : '—';
				const lowestPrice = typeof item.lowestPrice === 'number' ? `${item.lowestPrice} Robux` : '—';
				const lowestResale = typeof item.lowestResalePrice === 'number' ? `${item.lowestResalePrice} Robux` : '—';
				const quantity = typeof item.totalQuantity === 'number' ? String(item.totalQuantity) : '—';
				const category = assetTypeCategory(item.assetType) ?? '—';
				const createdAt = item.itemCreatedUtc ? `<t:${Math.floor(new Date(item.itemCreatedUtc).getTime() / 1000)}:D>` : '—';

				const embed = new EmbedBuilder()
					.setColor(target.embedConfig.COLOR)
					.setTitle((item.name || `Item #${item.id}`).slice(0, 256))
					.addFields(
						{ name: 'Category', value: category, inline: true },
						{ name: 'Price', value: price, inline: true },
						{ name: 'Creator', value: (item.creatorName || '—').slice(0, 1024), inline: true },
						{ name: 'Lowest Price', value: lowestPrice, inline: true },
						{ name: 'Lowest Resale', value: lowestResale, inline: true },
						{ name: 'Total Quantity', value: quantity, inline: true },
						{ name: 'Created', value: createdAt, inline: true }
					)
					.setFooter({ text: target.embedConfig.FOOTER });

				if (item.description?.trim()) embed.setDescription(item.description.trim().slice(0, 4096));
				if (item.thumbnailUrl?.startsWith('http')) embed.setThumbnail(item.thumbnailUrl);

				const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Open on Roblox').setEmoji('🛍️')
				);

				await target.channel.send({ embeds: [embed], components: [btnRow] });
				await db.markServerRobloxItemMessagePosted(target.serverId, item.id);
				await logger.log(`🛍️ Roblox catalog: posted item ${item.id} → ${target.channelId} (server ${target.serverId})`);
			} catch (err: any) {
				await logger.log(`❌ Roblox catalog: failed to post item ${item.id} for server ${target.serverId}: ${err?.message || err}`);
			}
		}
	}
}

async function runTick(client: Client, officialBotId: number) {
	if (tickRunning) return;
	tickRunning = true;
	try {
	const targets = await getActiveServers(client, officialBotId);
	if (targets.length === 0) return;

	const seen = new Set<number>();

	await streamCatalogPages({ CreatorType: 1, CreatorTargetId: 1, SortType: 2 }, async (items) => {
		await processPage(client, officialBotId, targets, items, seen);
	});

	await new Promise((r) => setTimeout(r, 30_000));

	await streamCatalogPages({ SalesTypeFilter: 2, SortType: 2 }, async (items) => {
		await processPage(client, officialBotId, targets, items, seen);
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
