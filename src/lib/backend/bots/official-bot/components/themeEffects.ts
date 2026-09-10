import db from '../../../../database.js';
import { logger } from '../../../../utils/index.js';
import { EFFECT_SPIN_COST, EFFECT_SPIN_GAME, effectMeta, rollEffect } from '../../../../effects.js';
import { getSpendableXp, spendXp } from './xp-economy.js';
import { evaluateMemberLevelAndRank } from './leveling.js';

const ANNOUNCE_DELAY_MS = 2500;

async function resolveServerMemberId(serverId: any, discordId: any) {
	const member = await db.getMemberByDiscordId(serverId, String(discordId)).catch(() => null);
	return member?.id ?? null;
}

export async function handleThemeEffectSpin(client: any, payload: any) {
	const { guild_id, actor_discord_id } = payload || {};
	if (!guild_id || !actor_discord_id) return { ok: false, error: 'missing_fields' };

	const { getServerForCurrentBot } = await import('../../../config.js');

	let server: any;
	try {
		server = await getServerForCurrentBot(guild_id);
	} catch (_) {
		return { ok: false, error: 'server_not_found' };
	}

	const actorMemberId = await resolveServerMemberId(server.id, actor_discord_id);
	if (!actorMemberId) return { ok: false, error: 'member_not_found' };

	const balance = await getSpendableXp(actorMemberId, guild_id);
	if (balance.total < EFFECT_SPIN_COST) return { ok: false, error: 'insufficient_xp' };

	const spend = await spendXp(actorMemberId, EFFECT_SPIN_COST, guild_id);
	if (!spend.ok) return { ok: false, error: 'insufficient_xp' };

	const { effect, seed } = rollEffect();
	await db.setMemberTheme(actorMemberId, { effect, effectSeed: seed, effectEnabled: true });

	await db
		.logMinigameAction(actorMemberId, {
			game: EFFECT_SPIN_GAME,
			multiplier: 1,
			wager: EFFECT_SPIN_COST,
			payout: 0,
			xp: -EFFECT_SPIN_COST,
			outcome: 'win',
			chance: null,
			luck_percent: null
		})
		.catch(() => null);

	await evaluateMemberLevelAndRank(guild_id, actorMemberId, { reason: 'effect_spin' }).catch(() => null);

	const result = { effect, seed, cost: EFFECT_SPIN_COST, label: effectMeta(effect)?.label ?? effect };
	setTimeout(() => {
		announceEffectSpin(client, { guildId: guild_id, actorDiscordId: actor_discord_id, result }).catch(() => null);
	}, ANNOUNCE_DELAY_MS);

	return { ok: true, result };
}

function fmtXp(v: any): string {
	return `${Math.abs(Number(v) || 0).toLocaleString()} XP`;
}

async function announceEffectSpin(client: any, ctx: any) {
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
		const embedConfig = await getEmbedConfig(guildId).catch(() => ({ COLOR: 0xc8911a, FOOTER: 'Minigames' }));

		const actor = actorDiscordId ? await guild.members.fetch(String(actorDiscordId)).catch(() => null) : null;
		const actorMention = actor ? `${actor}` : 'A member';

		const embed = new EmbedBuilder()
			.setColor(0xc8911a)
			.setTitle('✨ Theme Effect Spin')
			.setDescription(`${actorMention} spun for ${fmtXp(result.cost)} and landed **${result.label}**!`)
			.addFields(
				{ name: 'Effect', value: result.label, inline: true },
				{ name: 'XP spent', value: fmtXp(result.cost), inline: true },
				{ name: 'Variant', value: `#${result.seed}`, inline: true }
			)
			.setFooter({ text: embedConfig.FOOTER || 'Minigames' })
			.setTimestamp();

		const content = actor ? `${actor}` : undefined;
		await channel.send({ content, embeds: [embed] }).catch(() => null);
	} catch (err: any) {
		await logger.log(`⚠️ Theme effect spin announce failed: ${err?.message || String(err)}`);
	}
}
