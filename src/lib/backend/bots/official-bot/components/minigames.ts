import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { evaluateMemberLevelAndRank, determineLevel } from './leveling.js';
import { getSpendableXp, spendXp } from './xp-economy.js';
import { getActiveLuckPercent } from './items.js';
import { luckBoostLabel } from '../../../../items.js';
import { serverTranslator } from '../i18n.js';

const MIN_MULTIPLIER = 1.01;
const MAX_MULTIPLIER = 10;
const MIN_WAGER = 1;
const ANNOUNCE_DELAY_MS = 7000;

function clampMultiplier(raw: any): number {
	const m = Number(raw);
	if (!Number.isFinite(m)) return MIN_MULTIPLIER;
	return Math.min(MAX_MULTIPLIER, Math.max(MIN_MULTIPLIER, Math.round(m * 100) / 100));
}

function winChanceFor(multiplier: number): number {
	return 100 / multiplier;
}

async function resolveServerMemberId(serverId: any, discordId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordId)).catch(() => null);
	return member?.id ?? null;
}

export async function handleMinigamePlay(client: any, payload: any) {
	const { guild_id, actor_discord_id, multiplier, xp: amount } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot, isPublicSubFeatureEnabled } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}
	if (!(await isPublicSubFeatureEnabled(guild_id, 'minigames'))) {
		return { ok: false, error: 'minigames_disabled' };
	}

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const mult = clampMultiplier(multiplier);
	const luckPercent = await getActiveLuckPercent(actorMemberId);
	const baseChance = winChanceFor(mult);
	const chance = luckPercent > 0 ? Math.min(100, baseChance + luckPercent) : baseChance;

	const balance = await getSpendableXp(actorMemberId, guild_id);
	const wager = Math.max(0, Math.floor(Number(amount) || 0));
	if (wager < MIN_WAGER) return { ok: false, error: 'below_minimum', min: MIN_WAGER };
	if (wager > balance.total) return { ok: false, error: 'insufficient_xp' };

	const spend = await spendXp(actorMemberId, wager, guild_id);
	if (!spend.ok) return { ok: false, error: 'insufficient_xp' };

	const roll = Math.random() * 100;
	const won = roll < chance;

	let netChange = -wager;
	let payout = 0;
	if (won) {
		payout = Math.floor(wager * mult);
		await db.ensureMemberLevel(actorMemberId);
		const after = await db.updateMemberLevelStats(actorMemberId, { xpIncrement: payout });
		const rawXp = after?.xp ?? 0;
		const xp = typeof rawXp === 'bigint' ? Number(rawXp) : Number(rawXp) || 0;
		const expectedLevel = await determineLevel(xp, guild_id);
		let storedLevel = after?.level;
		if (typeof storedLevel === 'bigint') storedLevel = Number(storedLevel);
		if (storedLevel !== expectedLevel) await db.updateMemberLevelStats(actorMemberId, { level: expectedLevel });
		netChange = payout - wager;
	}

	await db
		.logMinigameAction(actorMemberId, {
			game: 'gamble',
			multiplier: mult,
			wager,
			payout,
			xp: netChange,
			outcome: won ? 'win' : 'lose',
			chance,
			luck_percent: luckPercent || null
		})
		.catch(() => null);

	await evaluateMemberLevelAndRank(guild_id, actorMemberId, { reason: 'minigame' }).catch(() => null);

	const result = { outcome: won ? 'win' : 'lose', won, wager, payout, net: netChange, multiplier: mult, chance, luckPercent };
	setTimeout(() => {
		announceMinigame(client, { guildId: guild_id, actorDiscordId: actor_discord_id, result }).catch(() => null);
	}, ANNOUNCE_DELAY_MS);

	return { ok: true, outcome: result.outcome, result };
}

function fmtXp(v: any): string {
	return `${Math.abs(Number(v) || 0).toLocaleString()} XP`;
}

async function announceMinigame(client: any, ctx: any) {
	const { guildId, actorDiscordId, result } = ctx;
	if (!result) return;

	try {
		const { getMinigamesChannelId, getEmbedConfig } = await import('../../../config.js');
		const channelId = await getMinigamesChannelId(guildId);
		if (!channelId) return;

		const guild = client?.guilds?.cache?.get(guildId);
		if (!guild) return;
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) return;

		const { EmbedBuilder } = await import('discord.js');
		const tr = await serverTranslator(guildId);
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: '' }));

		const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
		const actorMention = actor ? `${actor}` : tr('minigames.someone');
		const winChanceLabel = luckBoostLabel(result.chance - (result.luckPercent || 0), result.luckPercent);
		const story = { member: actorMention, wager: fmtXp(result.wager), multiplier: result.multiplier };

		const embed = new EmbedBuilder()
			.setColor(0xc8911a)
			.setFooter({ text: embedConfig.FOOTER || tr('minigames.footer') })
			.setTimestamp();

		if (result.won) {
			embed
				.setTitle(tr('minigames.win.title'))
				.setDescription(tr('minigames.win.description', story))
				.addFields(
					{ name: tr('minigames.fields.payout'), value: fmtXp(result.payout), inline: true },
					{ name: tr('minigames.fields.netGain'), value: `+${fmtXp(result.net)}`, inline: true },
					{ name: tr('minigames.fields.winChance'), value: winChanceLabel, inline: true }
				);
		} else {
			embed
				.setTitle(tr('minigames.lose.title'))
				.setDescription(tr('minigames.lose.description', story))
				.addFields(
					{ name: tr('minigames.fields.xpLost'), value: fmtXp(result.wager), inline: true },
					{ name: tr('minigames.fields.winChance'), value: winChanceLabel, inline: true }
				);
		}

		const content = actor ? `${actor}` : undefined;
		await channel.send({ content, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Minigame announce failed: ${err?.message || String(err)}`);
	}
}
