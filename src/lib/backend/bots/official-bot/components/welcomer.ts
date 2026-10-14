import { WELCOMER, getEmbedConfig, getBotConfig, isComponentFeatureEnabled, serverSettingsComponent } from '../../../config.js';
import { EmbedBuilder } from 'discord.js';
import db from '../../../../database.js';
import { logger, parseMySQLDateTimeUtc } from '../../../../utils/index.js';
import { pickGreetingMessage, postGreeting } from './greetings.js';
import { attributeJoin, type JoinInviteResult } from './invites.js';
import { INVITE_SOURCE_LABEL } from '../../../../invites.js';
import { serverTranslator, type Translator } from '../i18n.js';
import type { Client, GuildMember } from 'discord.js';
import { DAY_MS, SECOND_MS } from '../../../../utils/time.js';

const INVITE_WAIT_MS = 5_000;

async function waitForInvite(member: GuildMember): Promise<JoinInviteResult | null> {
	return Promise.race([attributeJoin(member), new Promise<null>((resolve) => setTimeout(() => resolve(null), INVITE_WAIT_MS))]).catch(() => null);
}

function inviterText(invite: JoinInviteResult | null, tr: Translator): string {
	if (invite?.inviterDiscordId) {
		return `<@${invite.inviterDiscordId}>`;
	}
	if (invite?.source === 'vanity') {
		return tr('welcomer.inviter.vanity');
	}
	if (invite?.source === 'server') {
		return tr('welcomer.inviter.server');
	}
	return tr('welcomer.inviter.someone');
}

function invitedByText(invite: JoinInviteResult, tr: Translator): string {
	if (!invite.inviterDiscordId) {
		return inviterText(invite, tr);
	}
	const link = INVITE_SOURCE_LABEL[invite.source] ? tr(`welcomer.inviteSources.${invite.source}`) : null;
	const inviter = tr('welcomer.inviterCount', { inviter: `<@${invite.inviterDiscordId}>`, count: invite.inviterTotal ?? 0 });
	return `${inviter}${link ? `\n${link}` : ''}`;
}

type WelcomeValues = {
	memberId: string;
	serverData: { name?: string | null } | null;
	memberData: Record<string, unknown>;
	memberCount: number;
	tr: Translator;
	invite?: JoinInviteResult | null;
};

function profileCreatedAt(memberData: Record<string, unknown>): Date | null {
	const value = memberData?.profile_created_at;
	if (!value) {
		return null;
	}
	return value instanceof Date ? value : parseMySQLDateTimeUtc(value as string);
}

function accountAgeText(createdAt: Date | null, tr: Translator) {
	const accountAge = createdAt ? Math.floor((Date.now() - createdAt.getTime()) / DAY_MS) : 0;
	if (accountAge === 0) {
		return tr('welcomer.accountAge.today');
	}
	return accountAge === 1 ? tr('welcomer.accountAge.oneDay') : tr('welcomer.accountAge.days', { days: accountAge });
}

function replacePlaceholders(message: string, { memberId, serverData, memberData, memberCount, tr, invite = null }: WelcomeValues) {
	return message
		.replace(/{user}/g, `<@${memberId}>`)
		.replace(/{server}/g, serverData?.name || tr('welcomer.unknownServer'))
		.replace(/{memberCount}/g, (memberCount || 0).toString())
		.replace(/{accountAge}/g, accountAgeText(profileCreatedAt(memberData), tr))
		.replace(/{inviter}/g, inviterText(invite, tr))
		.replace(/{inviteCount}/g, (invite?.inviterTotal ?? 0).toString());
}

function welcomeEmbed(
	tr: Translator,
	embedConfig: Awaited<ReturnType<typeof getEmbedConfig>>,
	values: WelcomeValues & { message: string; avatar: string | null }
) {
	const createdAt = profileCreatedAt(values.memberData);
	const accountCreatedTimestamp = Math.floor((createdAt ? createdAt.getTime() : Date.now()) / SECOND_MS);
	const { invite } = values;
	const hasInviter = !!invite && (!!invite.inviterDiscordId || invite.source === 'vanity' || invite.source === 'server');
	return new EmbedBuilder()
		.setColor(embedConfig.COLOR)
		.setTitle(tr('welcomer.title'))
		.setDescription(values.message)
		.setThumbnail(values.avatar)
		.addFields([
			{ name: tr('welcomer.fields.accountCreated'), value: `<t:${accountCreatedTimestamp}:R>`, inline: true },
			{ name: tr('welcomer.fields.memberCount'), value: tr('welcomer.memberNumber', { count: values.memberCount || 0 }), inline: true },
			...(hasInviter && invite ? [{ name: tr('welcomer.fields.invitedBy'), value: invitedByText(invite, tr), inline: true }] : [])
		])
		.setFooter({ text: embedConfig.FOOTER })
		.setTimestamp();
}

async function welcomeRecords(member: GuildMember, botId: number) {
	await member.guild.fetch().catch((fetchError) => logger.log(`⚠️ Failed to fetch guild ${member.guild.id} before welcome: ${(fetchError as Error).message}`));
	const serverData = await db.upsertOfficialServer(botId, member.guild);
	if (!serverData) {
		await logger.log(`⚠️ Server not found in database for ${member.guild.id}, skipping welcome message`);
		return null;
	}
	const memberData = (await db.upsertMember(serverData.id, member)) || (await db.getMemberByDiscordId(serverData.id, member.user.id));
	if (!memberData) {
		await logger.log(`⚠️ Member not found in database for ${member.user.id}, skipping welcome message`);
		return null;
	}
	return { serverData, memberData };
}

async function welcomeUser(member: GuildMember, client: Client) {
	try {
		const botConfig = getBotConfig();
		if (!botConfig || !botConfig.id) {
			await logger.log(`⚠️ Bot config not available, skipping welcome message`);
			return;
		}
		if (!(await isComponentFeatureEnabled(member.guild.id, serverSettingsComponent.welcomer))) {
			return;
		}

		const welcomeChannelIds = await WELCOMER.getChannels(member.guild.id);
		if (!welcomeChannelIds || welcomeChannelIds.length === 0) {
			await logger.log(`⚠️ No welcome channels configured for ${member.guild.id}, skipping welcome message`);
			return;
		}

		const records = await welcomeRecords(member, botConfig.id);
		if (!records) {
			return;
		}
		const { serverData, memberData } = records;
		const randomMessage = await pickGreetingMessage(WELCOMER, {
			guildId: member.guild.id,
			kind: 'welcome',
			label: 'welcome',
			botId: botConfig.id,
			serverId: serverData.id,
			serverName: member.guild?.name || serverData.name
		});
		if (!randomMessage) {
			return;
		}

		const memberCount = member.guild?.memberCount ?? (serverData?.total_members || 0);
		const invite = await waitForInvite(member);
		const tr = await serverTranslator(member.guild.id);
		const values: WelcomeValues = { memberId: member.user.id, serverData, memberData, memberCount, tr, invite };
		const embed = welcomeEmbed(tr, await getEmbedConfig(member.guild.id), {
			...values,
			message: replacePlaceholders(randomMessage, values),
			avatar: memberData.avatar || null
		});

		const memberName = memberData.display_name || memberData.username || `User ${member.user.id}`;
		await postGreeting(client, welcomeChannelIds, {
			embed,
			label: 'welcome',
			sentLog: (channel) => `✅ Welcomed ${memberName} (${member.user.id}) in ${serverData.name} to channel ${channel.name}`
		});
	} catch (err) {
		await logger.log(`❌ Failed to welcome ${member.user.id}: ${(err as Error).message}`);
	}
}

function init(client: Client) {
	client.on('guildMemberAdd', async (member: GuildMember) => {
		if (member.user?.bot) {
			return;
		}

		const botConfig = getBotConfig();
		if (botConfig && botConfig.id) {
			try {
				const serverData = await db.getServerByDiscordId(botConfig.id, member.guild.id);
				if (serverData) {
					const memberData = await db.getMemberByDiscordId(serverData.id, member.user.id);
					const memberName = memberData ? memberData.display_name || memberData.username : `User ${member.user.id}`;
					await logger.log(`👤 Member join event: ${memberName} (${member.user.id}) joined ${serverData.name}`);
				} else {
					await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
				}
			} catch (err) {
				await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
			}
		} else {
			await logger.log(`👤 Member join event: User ${member.user.id} joined ${member.guild.id}`);
		}
		await welcomeUser(member, client);
	});
}

export default { init };
