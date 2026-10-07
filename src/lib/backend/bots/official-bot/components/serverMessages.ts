import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import db from '../../../../database.js';
import { NOTIFICATIONS, getServerForCurrentBot, publicSiteOrigin } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import {
	MESSAGE_LIMITS,
	findMessageComponent,
	isMessageUploadKey,
	messagePayloadTextLength,
	parseMessageCustomId,
	renderMessagePayload,
	type MessageAction,
	type MessageDoc,
	type MessagePayload
} from '../../../../messages.js';
import { isServerLanguage, type ServerLanguage } from '../../../../languages.js';
import { readServerMessageFile, serverMessageFileUrl } from '../../../storage/serverMessages.js';
import { errorReasonFor, translatorFor, type Translator } from '../i18n.js';

type RoleAction = Extract<MessageAction, { type: 'role' }>;
type ShowAction = Extract<MessageAction, { type: 'show' }>;
type RoleBlock = 'deleted' | 'managed' | 'no_permission' | 'above_bot';
type LoadedFile = { attachment: Buffer; name: string };

const UNKNOWN_CHANNEL = 10003;
const UNKNOWN_MESSAGE = 10008;
const FILE_TOO_LARGE = 40005;
const FILE_MISSING = 'file_missing';

function imageUrl(value: string): string {
	if (!isMessageUploadKey(value)) return value;
	const url = serverMessageFileUrl(value);
	return url.startsWith('/') ? publicSiteOrigin() + url : url;
}

function render(
	doc: MessageDoc,
	messageId: number,
	lang: ServerLanguage,
	server: string,
	extra: { prefix?: string; interactive?: boolean } = {}
): MessagePayload {
	return renderMessagePayload(doc, { messageId, lang, server, image: imageUrl, ...extra });
}

async function loadFiles(payload: MessagePayload): Promise<LoadedFile[]> {
	const files: LoadedFile[] = [];
	for (const file of payload.files) {
		const data = await readServerMessageFile(file.key);
		if (!data) throw Object.assign(new Error(`Uploaded file ${file.key} is missing from storage`), { code: FILE_MISSING });
		files.push({ attachment: data, name: file.name });
	}
	return files;
}

function postLanguage(doc: MessageDoc, value: unknown): ServerLanguage {
	return isServerLanguage(value) && doc.languages.includes(value) ? value : doc.language;
}

function sendBody(payload: MessagePayload, files: LoadedFile[]): any {
	if (payload.v2) return { components: payload.components, flags: MessageFlags.IsComponentsV2, files };
	return { ...(payload.content ? { content: payload.content } : {}), embeds: payload.embeds, components: payload.components, files };
}

function privateBody(payload: MessagePayload, files: LoadedFile[]): any {
	return { ...sendBody(payload, files), flags: MessageFlags.Ephemeral | (payload.v2 ? MessageFlags.IsComponentsV2 : 0) };
}

function editBody(payload: MessagePayload, wasV2: boolean): any {
	if (!payload.v2) return { content: payload.content, embeds: payload.embeds, components: payload.components };
	const body = { components: payload.components, flags: MessageFlags.IsComponentsV2 };
	return wasV2 ? body : { ...body, content: null, embeds: [] };
}

function sameFiles(message: any, payload: MessagePayload): boolean {
	const current = [...message.attachments.values()].map((attachment: any) => String(attachment.name));
	return current.length === payload.files.length && payload.files.every((file, i) => file.name === current[i]);
}

function prefixFits(payload: MessagePayload, prefix: string): boolean {
	if (payload.v2) {
		return messagePayloadTextLength(payload) + prefix.length <= MESSAGE_LIMITS.blockText && payload.components.length < MESSAGE_LIMITS.components;
	}
	return (payload.content?.length ?? 0) + prefix.length + 1 <= MESSAGE_LIMITS.text;
}

function panelReason(error: any, channelName: string): string {
	const code = error?.code;
	if (code === 50001) return `The bot can't see #${channelName}. Give its role View Channel there.`;
	if (code === 50013) return `The bot can't post in #${channelName}. Give its role Send Messages, Embed Links and Attach Files there.`;
	if (code === UNKNOWN_CHANNEL) return `#${channelName} no longer exists.`;
	if (code === FILE_TOO_LARGE) return `A file is over this server's upload limit. Discord sets it from the server's boost level. Use a smaller file.`;
	if (code === FILE_MISSING) return 'An uploaded file is missing from storage. Remove it from the message and upload it again.';
	if (code === 50035) return `Discord rejected the message: ${String(error?.message ?? 'invalid content').slice(0, 300)}`;
	return `Discord refused it (${String(error?.message ?? 'unknown error').slice(0, 200)}). Try again in a moment.`;
}

async function resolveGuild(client: any, guildId: string) {
	return client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
}

function roleMentions(guild: any, roleIds: unknown): string {
	const out: string[] = [];
	for (const id of Array.isArray(roleIds) ? roleIds.map(String) : []) {
		if (id === 'everyone') out.push('@everyone');
		else if (id === 'here') out.push('@here');
		else if (guild.roles.cache.has(id)) out.push(`<@&${id}>`);
	}
	return out.join(' ');
}

export async function sendServerMessage(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, error: 'The bot is not in this server.' };
	const message = await db.getServerMessage(payload.server_id, payload.message_id);
	if (!message) return { ok: false, error: 'That message no longer exists.' };

	const lang = postLanguage(message.content, payload.language);
	const roles = roleMentions(guild, payload.role_ids);
	const plain = render(message.content, message.id, lang, guild.name);
	if (plain.empty) return { ok: false, error: 'This message has nothing to send yet.' };

	let files: LoadedFile[];
	try {
		files = await loadFiles(plain);
	} catch (error: any) {
		await logger.log(`❌ Failed to load files for message ${message.id}: ${error?.message}`);
		return { ok: false, error: panelReason(error, '') };
	}

	const results: { channel_id: string; ok: boolean; message_id?: string; mentions?: string | null; error?: string }[] = [];
	for (const channelId of Array.isArray(payload.channel_ids) ? payload.channel_ids.map(String) : []) {
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			results.push({ channel_id: channelId, ok: false, error: 'That channel no longer exists or is not a text channel.' });
			continue;
		}
		try {
			const chunks = (await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(guild.id, channelId).catch(() => null)) ?? [];
			const prefix = [roles, chunks[0]].filter(Boolean).join(' ');
			const inline = prefix !== '' && prefixFits(plain, prefix);
			const sent = await channel.send(sendBody(inline ? render(message.content, message.id, lang, guild.name, { prefix }) : plain, files));
			for (const extra of inline ? chunks.slice(1) : [prefix, ...chunks.slice(1)]) {
				if (extra) await channel.send({ content: extra }).catch(() => null);
			}
			results.push({ channel_id: channelId, ok: true, message_id: sent.id, mentions: inline ? prefix : null });
			await logger.log(`📤 Message "${message.name}" sent to #${channel.name} (${channel.id}) in ${guild.name} (${guild.id})`);
		} catch (error: any) {
			await logger.log(`❌ Failed to send message ${message.id} to channel ${channelId}: ${error?.message}`);
			results.push({ channel_id: channelId, ok: false, error: panelReason(error, channel.name ?? channelId) });
		}
	}

	return { ok: true, results };
}

export async function syncServerMessagePosts(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, error: 'The bot is not in this server.' };
	const message = await db.getServerMessage(payload.server_id, payload.message_id);
	if (!message) return { ok: false, error: 'That message no longer exists.' };

	const interactive = payload.interactive !== false;
	const posts = await db.getServerMessagePosts(payload.server_id, message.id);
	const results: { post_id: number; channel_id: string; channel_name: string; ok: boolean; gone?: boolean; error?: string }[] = [];

	for (const post of posts) {
		const base = { post_id: post.id, channel_id: post.discord_channel_id, channel_name: post.channel_name };
		try {
			const channel = await guild.channels
				.fetch(post.discord_channel_id)
				.catch((error: any) => (error?.code === UNKNOWN_CHANNEL ? null : Promise.reject(error)));
			const posted = channel?.isTextBased()
				? await channel.messages.fetch(post.discord_message_id).catch((error: any) => (error?.code === UNKNOWN_MESSAGE ? null : Promise.reject(error)))
				: null;
			if (!posted) {
				results.push({ ...base, ok: true, gone: true });
				continue;
			}
			const wasV2 = posted.flags.has(MessageFlags.IsComponentsV2);
			const rendered = render(message.content, message.id, postLanguage(message.content, post.language), guild.name, {
				prefix: post.mentions ?? '',
				interactive
			});
			if (rendered.empty) {
				if (interactive) {
					results.push({ ...base, ok: false, error: 'This message has nothing left to show. Add something to it, or remove the posted copies.' });
				} else {
					await posted.delete();
					results.push({ ...base, ok: true, gone: true });
				}
				continue;
			}
			if (wasV2 && !rendered.v2) {
				results.push({
					...base,
					ok: false,
					error: `The copy in #${post.channel_name} was sent as Components V2, and Discord never lets that turn back into a standard message. Remove that copy and send it again.`
				});
				continue;
			}
			const body = editBody(rendered, wasV2);
			await posted.edit(sameFiles(posted, rendered) ? body : { ...body, files: await loadFiles(rendered), attachments: [] });
			results.push({ ...base, ok: true });
		} catch (error: any) {
			await logger.log(`❌ Failed to update message ${message.id} post ${post.id}: ${error?.message}`);
			results.push({ ...base, ok: false, error: panelReason(error, post.channel_name) });
		}
	}

	return { ok: true, results };
}

export async function removeServerMessagePost(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, error: 'The bot is not in this server.' };
	try {
		const channel = await guild.channels.fetch(String(payload.channel_id)).catch(() => null);
		const posted = channel?.isTextBased() ? await channel.messages.fetch(String(payload.discord_message_id)).catch(() => null) : null;
		if (posted) await posted.delete();
		return { ok: true };
	} catch (error: any) {
		await logger.log(`❌ Failed to delete posted message ${payload.discord_message_id}: ${error?.message}`);
		return { ok: false, error: panelReason(error, String(payload.channel_name ?? payload.channel_id)) };
	}
}

export async function listGuildEmojis(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, emojis: [] };
	return {
		ok: true,
		emojis: [...guild.emojis.cache.values()]
			.filter((emoji: any) => emoji.available !== false && emoji.name)
			.map((emoji: any) => ({ id: String(emoji.id), name: String(emoji.name), animated: emoji.animated === true }))
	};
}

function roleBlock(guild: any, role: any): RoleBlock | null {
	if (!role) return 'deleted';
	if (role.managed) return 'managed';
	if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'no_permission';
	if (!role.editable) return 'above_bot';
	return null;
}

async function applyRoles(interaction: any, actions: RoleAction[], tr: Translator): Promise<string[]> {
	const guild = interaction.guild;
	const member = await guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) return [tr('common.errors.memberNotFound')];

	const lines: string[] = [];
	for (const action of actions) {
		const role = guild.roles.cache.get(action.role_id) ?? (await guild.roles.fetch(action.role_id).catch(() => null));
		const mention = `<@&${action.role_id}>`;
		const block = roleBlock(guild, role);
		if (block) {
			lines.push(tr(`serverMessages.blocked.${block}`, { role: mention }));
			continue;
		}
		const has = member.roles.cache.has(role.id);
		const give = action.mode === 'add' || (action.mode === 'toggle' && !has);
		if (give === has) {
			lines.push(tr(give ? 'serverMessages.roleAlready' : 'serverMessages.roleNotHeld', { role: mention }));
			continue;
		}
		try {
			if (give) await member.roles.add(role.id, 'Message button');
			else await member.roles.remove(role.id, 'Message button');
			lines.push(tr(give ? 'serverMessages.roleAdded' : 'serverMessages.roleRemoved', { role: mention }));
		} catch (error: any) {
			await logger.log(`❌ Message button could not change role ${action.role_id} for ${interaction.user.id}: ${error?.message}`);
			lines.push(tr('serverMessages.roleFailed', { role: mention, reason: errorReasonFor(tr, error) }));
		}
	}
	return lines;
}

async function memberLanguage(serverId: number, userId: string, fallback: ServerLanguage): Promise<ServerLanguage> {
	const member = await db.getMemberByDiscordId(serverId, userId).catch(() => null);
	return isServerLanguage(member?.language) ? member.language : fallback;
}

export function isServerMessageComponentId(customId: unknown): boolean {
	return parseMessageCustomId(customId) !== null;
}

export async function handleServerMessageComponent(interaction: any) {
	const ref = parseMessageCustomId(interaction.customId);
	if (!ref || !interaction.guild) return;

	const guild = interaction.guild;
	const server = await getServerForCurrentBot(guild.id);
	const lang = await memberLanguage(server.id, interaction.user.id, ref.lang);
	const tr = translatorFor(lang);
	const privately = (content: string) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

	const message = await db.getServerMessage(server.id, ref.messageId);
	const component = message ? findMessageComponent(message.content, ref.partId) : null;
	if (!message || !component) {
		await interaction.reply(privately(tr('serverMessages.unavailable')));
		return;
	}

	const picked: string[] = component.kind === 'select' ? (interaction.values ?? []) : [];
	const actions =
		component.kind === 'button' ? component.button.actions : component.select.options.filter((o) => picked.includes(o.id)).flatMap((o) => o.actions);
	const show = actions.find((a): a is ShowAction => a.type === 'show');
	const roles = actions.filter((a): a is RoleAction => a.type === 'role');
	if (!show && roles.length === 0) {
		await interaction.reply(privately(tr('serverMessages.notSetUp')));
		return;
	}

	const target = show ? await db.getServerMessage(server.id, show.message_id) : null;
	const rendered = target ? render(target.content, target.id, lang, guild.name) : null;
	const shown = rendered && !rendered.empty ? rendered : null;
	const source = interaction.message;
	const sourceV2 = source.flags.has(MessageFlags.IsComponentsV2);
	const inPlace = !!shown && source.flags.has(MessageFlags.Ephemeral) && (shown.v2 || !sourceV2);
	const lines: string[] = [];
	let acknowledged = false;
	let pendingReply = false;

	if (inPlace && shown) {
		const slow = shown.files.length > 0;
		if (slow) await interaction.deferUpdate();
		const files = await loadFiles(shown).catch(() => null);
		if (files) {
			const body = { ...editBody(shown, sourceV2), files, attachments: [] };
			if (slow) await interaction.editReply(body);
			else await interaction.update(body);
		} else lines.push(tr('serverMessages.unavailable'));
		acknowledged = true;
	} else if (component.kind === 'select') {
		const post = await db.getServerMessagePosts(server.id, message.id).then((posts) => posts.find((p) => p.discord_message_id === source.id));
		const again = render(message.content, message.id, ref.lang, guild.name, { prefix: post?.mentions ?? '' });
		await interaction.update(again.v2 ? { components: again.components, flags: MessageFlags.IsComponentsV2 } : { components: again.components });
		acknowledged = true;
	}

	if (show && !shown) lines.push(tr('serverMessages.unavailable'));
	if (shown && !inPlace) {
		if (!acknowledged && shown.files.length > 0) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			pendingReply = true;
		}
		const files = await loadFiles(shown).catch(() => null);
		if (!files) lines.push(tr('serverMessages.unavailable'));
		else if (pendingReply) {
			await interaction.editReply(sendBody(shown, files));
			pendingReply = false;
		} else if (acknowledged) await interaction.followUp(privateBody(shown, files));
		else await interaction.reply(privateBody(shown, files));
		acknowledged = true;
	}
	if (!acknowledged) {
		await interaction.deferReply({ flags: MessageFlags.Ephemeral });
		pendingReply = true;
	}

	lines.push(...(await applyRoles(interaction, roles, tr)));
	if (lines.length === 0) return;
	const result = { content: lines.join('\n'), allowedMentions: { parse: [] } };
	if (pendingReply) await interaction.editReply(result);
	else await interaction.followUp({ ...result, flags: MessageFlags.Ephemeral });
}
