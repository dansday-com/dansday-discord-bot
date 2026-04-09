import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { getEmbedConfig, getMainChannel, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import { assetTypeCategory, fetchAllCatalogVerifiedCreators, robloxCatalogItemUrl } from '../../../../roblox-catalog-api.js';

let tickTimeoutRef: ReturnType<typeof setTimeout> | null = null;

const POLL_MS = 60_000;

async function runTick(client: Client, officialBotId: number) {
	const servers = await db.getServersForBot(officialBotId);

	const items = await fetchAllCatalogVerifiedCreators();
	if (items.length === 0) return;

	const snapshots = items.map((x) => ({
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

		await db.syncServerRobloxItemsFromApi(officialBotId, server.id, snapshots);

		const assetIds = items.map((x) => x.id);
		const unposted = new Set(await db.listServerRobloxUnpostedAssetIds(server.id, assetIds));
		if (unposted.size === 0) continue;

		const embedConfig = await getEmbedConfig(guildId);
		const guild = await client.guilds.fetch(guildId).catch(() => null);
		if (!guild) continue;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) continue;

		for (const item of items) {
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
					.setColor(embedConfig.COLOR)
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
					.setFooter({ text: embedConfig.FOOTER });

				if (item.description?.trim()) embed.setDescription(item.description.trim().slice(0, 4096));
				if (item.thumbnailUrl?.startsWith('http')) embed.setThumbnail(item.thumbnailUrl);

				const btnRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
					new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(url).setLabel('Open on Roblox').setEmoji('🛍️')
				);

				await channel.send({ embeds: [embed], components: [btnRow] });
				await db.markServerRobloxItemMessagePosted(server.id, item.id);
				await logger.log(`🛍️ Roblox catalog: posted item ${item.id} → ${channelId} (${server.name})`);
			} catch (err: any) {
				await logger.log(`❌ Roblox catalog: failed to post item ${item.id} for server ${server.id}: ${err?.message || err}`);
			}
		}
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
