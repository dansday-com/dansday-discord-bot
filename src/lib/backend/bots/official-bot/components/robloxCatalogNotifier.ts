import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { getEmbedConfig, getMainChannel, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import {
	fetchRobloxCatalogSearchDetails,
	fetchRobloxThumbnailUrls,
	inferIsFreeFromSearch,
	inferIsLimitedFromSearch,
	isRobloxOfficialCreator,
	robloxAssetTypeLabel,
	robloxCatalogItemUrl
} from '../../../../roblox-catalog-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;

const POLL_MS = 60_000;
const POLL_JITTER_MS = 15_000;

type RobloxItemSnapshot = {
	assetId: number;
	itemType?: string;
	assetType?: number | null;
	name?: string | null;
	description?: string | null;
	creatorType?: string | null;
	creatorTargetId?: number | null;
	creatorName?: string | null;
	price?: number | null;
	lowestPrice?: number | null;
	lowestResalePrice?: number | null;
	totalQuantity?: number | null;
	collectibleItemId?: string | null;
	itemCreatedUtc?: string | null;
	isFree?: boolean;
	isLimited?: boolean;
	isOfficial?: boolean;
	itemUrl?: string | null;
	thumbnailUrl?: string | null;
};

async function sendRobloxCatalogNotificationMessage(client: Client, guildId: string, channelId: string, it: RobloxItemSnapshot) {
	const guild = await client.guilds.fetch(guildId).catch(() => null);
	if (!guild) throw new Error('Guild not found');
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	if (!channel || !channel.isTextBased()) throw new Error('Channel not found or not text-based');

	const embedConfig = await getEmbedConfig(guildId);

	const flags: string[] = [];
	if (it.isFree) flags.push('FREE');
	if (it.isLimited) flags.push('LIMITED');
	if (it.isOfficial) flags.push('OFFICIAL');

	const title = (it.name || `Roblox item #${it.assetId}`).slice(0, 256);
	const embed = new EmbedBuilder().setColor(embedConfig.COLOR).setTitle(title);

	const price = typeof it.price === 'number' ? (it.price === 0 ? 'FREE' : `${it.price} Robux`) : it.isFree ? 'FREE' : '—';

	const creator = (it.creatorName || '—').slice(0, 1024);
	const kind = typeof it.itemType === 'string' && it.itemType ? it.itemType : 'Item';
	const assetLabel = robloxAssetTypeLabel(it.assetType);
	const meta = [
		`Kind: ${kind}`,
		assetLabel ? `Category: ${assetLabel}` : typeof it.assetType === 'number' ? `Category: AssetType ${it.assetType}` : null,
		flags.length ? flags.join(' · ') : null
	]
		.filter(Boolean)
		.join('\n')
		.slice(0, 1024);

	embed.addFields(
		{ name: 'Price', value: String(price).slice(0, 1024), inline: true },
		{ name: 'Creator', value: creator, inline: true },
		{ name: 'Info', value: meta || '—', inline: false }
	);

	const desc = (it.description || '').trim();
	if (desc) embed.setDescription(desc.slice(0, 4096));
	embed.setFooter({ text: embedConfig.FOOTER });
	const thumb = it.thumbnailUrl?.trim();
	if (thumb?.startsWith('http')) embed.setThumbnail(thumb);

	const url = it.itemUrl?.trim() || robloxCatalogItemUrl(it.assetId);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Open on Roblox').setEmoji('🛍️')
	);

	await channel.send({ embeds: [embed], components: [row] });
}

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	for (const server of servers) {
		const guildId = server.discord_server_id;
		if (!guildId) continue;
		if (!(await isComponentFeatureEnabled(guildId, serverSettingsComponent.roblox_catalog_notifier))) continue;

		const row = await db.getServerSettings(server.id, serverSettingsComponent.roblox_catalog_notifier).catch(() => null);
		const rawSettings = row && !Array.isArray(row) ? row.settings : null;
		const s = rawSettings && typeof rawSettings === 'object' ? (rawSettings as Record<string, unknown>) : {};

		let channelId = typeof s.channel_id === 'string' ? s.channel_id : '';
		if (!channelId) {
			try {
				channelId = await getMainChannel(guildId);
			} catch {
				channelId = '';
			}
		}
		if (!channelId) continue;

		try {
			const seenRelevantAssetIds = new Set<number>();
			let cursor: string | null = null;

			while (true) {
				const { items, nextCursor } = await fetchRobloxCatalogSearchDetails({
					limit: 120,
					sortType: 3,
					cursor: cursor || undefined
				});
				cursor = nextCursor;

				const pageSnapshots: RobloxItemSnapshot[] = [];
				for (const x of items) {
					if (!Number.isFinite(Number(x?.id))) continue;
					const assetId = Number(x.id);

					const isFree = inferIsFreeFromSearch(x);
					const isLimited = inferIsLimitedFromSearch(x);
					const isOfficial = isRobloxOfficialCreator(x.creatorName, x.creatorTargetId);
					const isVerifiedCreator = x.creatorHasVerifiedBadge === true;
					if (!isVerifiedCreator && !isOfficial) continue;

					if (seenRelevantAssetIds.has(assetId)) continue;
					seenRelevantAssetIds.add(assetId);

					pageSnapshots.push({
						assetId,
						itemType: x.itemType,
						assetType: x.assetType ?? null,
						name: x.name ?? null,
						description: x.description ?? null,
						creatorType: x.creatorType ?? null,
						creatorTargetId: x.creatorTargetId ?? null,
						creatorName: x.creatorName ?? null,
						price: x.price ?? null,
						lowestPrice: x.lowestPrice ?? null,
						lowestResalePrice: x.lowestResalePrice ?? null,
						totalQuantity: x.totalQuantity ?? null,
						collectibleItemId: x.collectibleItemId ?? null,
						itemCreatedUtc: x.itemCreatedUtc ?? null,
						isFree,
						isLimited,
						isOfficial,
						itemUrl: robloxCatalogItemUrl(assetId),
						thumbnailUrl: null
					});
				}

				if (pageSnapshots.length > 0) {
					const thumbMap = await fetchRobloxThumbnailUrls(pageSnapshots.map((x) => ({ id: x.assetId, itemType: x.itemType || 'Asset' })));
					for (const it of pageSnapshots) {
						const url = thumbMap.get(it.assetId) || null;
						it.thumbnailUrl = url;
					}
					await db.syncServerRobloxItemsFromApi(officialBotId, server.id, pageSnapshots);

					const notifyAssetIds = pageSnapshots.filter((x) => x.isFree || x.isLimited || x.isOfficial).map((x) => x.assetId);
					const unposted = new Set(await db.listServerRobloxUnpostedAssetIds(server.id, notifyAssetIds));
					if (unposted.size > 0) {
						for (const it of pageSnapshots) {
							if (!it.isFree && !it.isLimited && !it.isOfficial) continue;
							if (!unposted.has(it.assetId)) continue;
							try {
								await sendRobloxCatalogNotificationMessage(client, guildId, channelId, it);
								await db.markServerRobloxItemMessagePosted(server.id, it.assetId);
								await logger.log(`🛍️ Roblox catalog: posted item ${it.assetId} → channel ${channelId} (${server.name})`);
							} catch (sendErr: any) {
								await logger.log(`❌ Roblox catalog: failed to post item ${it.assetId} for server ${server.id}: ${sendErr?.message || sendErr}`);
							}
						}
					}
				}

				if (!cursor) break;
			}
		} catch (e: any) {
			await logger.log(`⚠️ Roblox catalog tick failed for server ${server.id} (${server.name}): ${e?.message || e}`);
		}
	}
}

function scheduleNextRobloxCatalogTick(client: Client, officialBotId: number) {
	const delay = POLL_MS + Math.floor(Math.random() * POLL_JITTER_MS);
	tickTimeoutRef = setTimeout(() => {
		runTick(client, officialBotId)
			.catch((err) => logger.log(`❌ Roblox catalog tick error: ${err?.message || err}`))
			.finally(() => scheduleNextRobloxCatalogTick(client, officialBotId));
	}, delay);
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
	scheduleNextRobloxCatalogTick(client, officialBotId);
}

export function stopRobloxCatalogNotifier() {
	if (tickTimeoutRef) {
		clearTimeout(tickTimeoutRef);
		tickTimeoutRef = null;
	}
}

export default { initRobloxCatalogNotifier, stopRobloxCatalogNotifier };
