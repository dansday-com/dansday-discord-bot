import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import db, { type ServerMessage, type ServerMessagePost } from '../../../../database.js';
import { NOTIFICATIONS, getBotConfig, getEmbedConfig, getServerForCurrentBot, publicSiteOrigin } from '../../../config.js';
import { logger } from '../../../../utils/index.js';
import {
	MESSAGE_LANGUAGE_PART,
	MESSAGE_LIMITS,
	findMessageComponent,
	isMessageUploadKey,
	isSelfAssignableRole,
	messagePayloadTextLength,
	parseMessageCustomId,
	renderMessagePayload,
	type MessageAction,
	type MessageDoc,
	type MessagePayload,
	type MessageScope
} from '../../../../messages.js';
import { isServerLanguage, type ServerLanguage } from '../../../../languages.js';
import { messageFileUrl, readMessageFile } from '../../../storage/messageFiles.js';
import { errorReasonFor, translatorFor, type Translator } from '../i18n.js';

type RoleAction = Extract<MessageAction, { type: 'role' }>;
type ShowAction = Extract<MessageAction, { type: 'show' }>;
type RoleBlock = 'deleted' | 'managed' | 'unsafe' | 'no_permission' | 'above_bot';
type LoadedFile = { attachment: Buffer; name: string };
type RenderExtra = { prefix?: string; interactive?: boolean; pinned?: boolean; defaultColor?: number | null };
type Renderer = (lang: ServerLanguage, extra?: RenderExtra) => MessagePayload;
type SyncResult = { post_id: number; channel_id: string; channel_name: string; ok: boolean; gone?: boolean; error?: string };

const UNKNOWN_CHANNEL = 10003;
const UNKNOWN_MESSAGE = 10008;
const FILE_TOO_LARGE = 40005;
const FILE_MISSING = 'file_missing';
const ROLE_COOLDOWN_MS = 3000;
const ROLE_COOLDOWN_SWEEP_AT = 2000;

const roleCooldowns = new Map<string, number>();

let panelId: Promise<number | null> | null = null;

function currentBotId(): number {
	return Number(getBotConfig()?.id);
}

function currentPanelId(): Promise<number | null> {
	panelId ??= db.getBotPanelId(currentBotId()).catch(() => null);
	return panelId;
}

function imageUrl(value: string): string {
	if (!isMessageUploadKey(value)) return value;
	const url = messageFileUrl(value);
	return url.startsWith('/') ? publicSiteOrigin() + url : url;
}

function renderer(scope: MessageScope, message: ServerMessage, server: string, defaults: RenderExtra = {}): Renderer {
	return (lang, extra = {}) => renderMessagePayload(message.content, { scope, messageId: message.id, lang, server, image: imageUrl, ...defaults, ...extra });
}

async function loadFiles(payload: MessagePayload): Promise<LoadedFile[]> {
	const files: LoadedFile[] = [];
	for (const file of payload.files) {
		const data = await readMessageFile(file.key);
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

function groupMentions(guild: any, groups: unknown, staffRoles: unknown): string {
	const wanted = Array.isArray(groups) ? groups.map(String) : [];
	const out: string[] = [];
	if (wanted.includes('everyone')) out.push('@everyone');
	if (wanted.includes('here')) out.push('@here');
	const roleIds = new Set<string>();
	if (wanted.includes('admin')) {
		for (const role of guild.roles.cache.values()) {
			if (role.id !== guild.id && !role.managed && role.permissions?.has?.(PermissionFlagsBits.Administrator)) roleIds.add(String(role.id));
		}
	}
	if (wanted.includes('staff')) {
		for (const id of Array.isArray(staffRoles) ? staffRoles : []) if (id) roleIds.add(String(id));
	}
	return [...out, ...[...roleIds].map((id) => `<@&${id}>`)].join(' ');
}

async function post(channel: any, render: Renderer, lang: ServerLanguage, files: LoadedFile[], mentions: string) {
	const chunks = (await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(channel.guild.id, channel.id).catch(() => null)) ?? [];
	const prefix = [mentions, chunks[0]].filter(Boolean).join(' ');
	const plain = render(lang);
	const inline = prefix !== '' && prefixFits(plain, prefix);
	const sent = await channel.send(sendBody(inline ? render(lang, { prefix }) : plain, files));
	for (const extra of inline ? chunks.slice(1) : [prefix, ...chunks.slice(1)]) {
		if (extra) await channel.send({ content: extra }).catch(() => null);
	}
	return { message_id: String(sent.id), mentions: inline ? prefix : null };
}

async function syncPost(guild: any, entry: ServerMessagePost, doc: MessageDoc, render: Renderer, interactive: boolean): Promise<SyncResult> {
	const base = { post_id: entry.id, channel_id: entry.discord_channel_id, channel_name: entry.channel_name };
	try {
		const channel = await guild.channels
			.fetch(entry.discord_channel_id)
			.catch((error: any) => (error?.code === UNKNOWN_CHANNEL ? null : Promise.reject(error)));
		const posted = channel?.isTextBased()
			? await channel.messages.fetch(entry.discord_message_id).catch((error: any) => (error?.code === UNKNOWN_MESSAGE ? null : Promise.reject(error)))
			: null;
		if (!posted) return { ...base, ok: true, gone: true };

		const wasV2 = posted.flags.has(MessageFlags.IsComponentsV2);
		const rendered = render(postLanguage(doc, entry.language), { prefix: entry.mentions ?? '', interactive });
		if (rendered.empty) {
			if (interactive) return { ...base, ok: false, error: 'This message has nothing left to show. Add something to it, or remove the posted copies.' };
			await posted.delete();
			return { ...base, ok: true, gone: true };
		}
		if (wasV2 && !rendered.v2) {
			return {
				...base,
				ok: false,
				error: `The copy in #${entry.channel_name} was sent as Components V2, and Discord never lets that turn back into a standard message. Remove that copy and send it again.`
			};
		}
		const body = editBody(rendered, wasV2);
		await posted.edit(sameFiles(posted, rendered) ? body : { ...body, files: await loadFiles(rendered), attachments: [] });
		return { ...base, ok: true };
	} catch (error: any) {
		await logger.log(`❌ Failed to update posted message ${entry.discord_message_id}: ${error?.message}`);
		return { ...base, ok: false, error: panelReason(error, entry.channel_name) };
	}
}

async function removePosted(guild: any, channelId: string, discordMessageId: string) {
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	const posted = channel?.isTextBased() ? await channel.messages.fetch(discordMessageId).catch(() => null) : null;
	if (posted) await posted.delete();
}

async function serverColor(guildId: string): Promise<number | null> {
	const config = await getEmbedConfig(guildId).catch(() => null);
	return config && Number.isFinite(config.COLOR) ? config.COLOR : null;
}

export async function sendServerMessage(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, error: 'The bot is not in this server.' };
	const message = await db.getServerMessage(payload.server_id, payload.message_id);
	if (!message) return { ok: false, error: 'That message no longer exists.' };

	const lang = postLanguage(message.content, payload.language);
	const render = renderer('server', message, guild.name);
	if (render(lang).empty) return { ok: false, error: 'This message has nothing to send yet.' };

	let files: LoadedFile[];
	try {
		files = await loadFiles(render(lang));
	} catch (error: any) {
		await logger.log(`❌ Failed to load files for message ${message.id}: ${error?.message}`);
		return { ok: false, error: panelReason(error, '') };
	}

	const mentions = roleMentions(guild, payload.role_ids);
	const results: { channel_id: string; ok: boolean; message_id?: string; mentions?: string | null; error?: string }[] = [];
	for (const channelId of Array.isArray(payload.channel_ids) ? payload.channel_ids.map(String) : []) {
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			results.push({ channel_id: channelId, ok: false, error: 'That channel no longer exists or is not a text channel.' });
			continue;
		}
		try {
			results.push({ channel_id: channelId, ok: true, ...(await post(channel, render, lang, files, mentions)) });
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

	const render = renderer('server', message, guild.name);
	const results: SyncResult[] = [];
	for (const entry of await db.getServerMessagePosts(payload.server_id, message.id)) {
		results.push(await syncPost(guild, entry, message.content, render, payload.interactive !== false));
	}
	return { ok: true, results };
}

export async function removeServerMessagePost(client: any, payload: any) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) return { ok: false, error: 'The bot is not in this server.' };
	try {
		await removePosted(guild, String(payload.channel_id), String(payload.discord_message_id));
		return { ok: true };
	} catch (error: any) {
		await logger.log(`❌ Failed to delete posted message ${payload.discord_message_id}: ${error?.message}`);
		return { ok: false, error: panelReason(error, String(payload.channel_name ?? payload.channel_id)) };
	}
}

export async function sendGlobalMessage(client: any, payload: any) {
	const panel = await currentPanelId();
	const message = panel == null ? null : await db.getGlobalMessage(panel, payload.message_id);
	if (!message) return { ok: false, error: 'That message no longer exists.' };

	let files: LoadedFile[];
	try {
		files = await loadFiles(renderer('global', message, '')(message.content.language));
	} catch (error: any) {
		await logger.log(`❌ Failed to load files for global message ${message.id}: ${error?.message}`);
		return { ok: false, error: panelReason(error, '') };
	}

	const results: any[] = [];
	for (const server of await db.getServersForBot(currentBotId())) {
		const base = { server_id: server.id, server_name: String(server.name ?? 'Server') };
		try {
			const row = await db.getServerSettings(server.id, 'main').catch(() => null);
			const settings: any = (Array.isArray(row) ? row[0]?.settings : row?.settings) ?? {};
			const channelId = settings.bot_updates_channel_id ? String(settings.bot_updates_channel_id) : '';
			const guild = channelId ? await resolveGuild(client, String(server.discord_server_id)) : null;
			if (!guild) {
				results.push({ ...base, ok: false, skipped: true });
				continue;
			}
			const channel = await guild.channels.fetch(channelId).catch(() => null);
			if (!channel || !channel.isTextBased()) {
				results.push({ ...base, ok: false, error: 'Its Bot Updates Channel no longer exists. Pick a new one on the Main page.' });
				continue;
			}
			const lang = postLanguage(message.content, settings.language);
			const render = renderer('global', message, guild.name, { defaultColor: await serverColor(guild.id) });
			if (render(lang).empty) {
				results.push({ ...base, ok: false, error: 'This message has nothing to send yet.' });
				continue;
			}
			const sent = await post(channel, render, lang, files, groupMentions(guild, payload.mention_groups, settings.staff_roles));
			results.push({ ...base, ok: true, channel_id: channelId, language: lang, ...sent });
			await logger.log(`📤 Global message "${message.name}" sent to #${channel.name} in ${guild.name} (${guild.id})`);
		} catch (error: any) {
			await logger.log(`❌ Failed to send global message ${message.id} to server ${server.id}: ${error?.message}`);
			results.push({ ...base, ok: false, error: panelReason(error, 'bot-updates') });
		}
	}

	return { ok: true, results };
}

export async function syncGlobalMessagePosts(client: any, payload: any) {
	const panel = await currentPanelId();
	const message = panel == null ? null : await db.getGlobalMessage(panel, payload.message_id);
	if (!message || panel == null) return { ok: false, error: 'That message no longer exists.' };

	const results: SyncResult[] = [];
	for (const entry of await db.getGlobalMessagePosts(panel, message.id, currentBotId())) {
		const guild = await resolveGuild(client, entry.discord_server_id);
		if (!guild) {
			results.push({ post_id: entry.id, channel_id: entry.discord_channel_id, channel_name: entry.channel_name, ok: true, gone: true });
			continue;
		}
		const render = renderer('global', message, guild.name, { defaultColor: await serverColor(guild.id) });
		results.push(await syncPost(guild, entry, message.content, render, payload.interactive !== false));
	}
	return { ok: true, results };
}

export async function removeGlobalMessagePosts(client: any, payload: any) {
	const panel = await currentPanelId();
	if (panel == null) return { ok: false, error: 'This bot has no panel.' };
	const wanted = new Set((Array.isArray(payload.post_ids) ? payload.post_ids : []).map(Number));
	const results: { post_id: number; ok: boolean; error?: string }[] = [];
	for (const entry of await db.getGlobalMessagePosts(panel, Number(payload.message_id), currentBotId())) {
		if (!wanted.has(entry.id)) continue;
		try {
			const guild = await resolveGuild(client, entry.discord_server_id);
			if (guild) await removePosted(guild, entry.discord_channel_id, entry.discord_message_id);
			results.push({ post_id: entry.id, ok: true });
		} catch (error: any) {
			await logger.log(`❌ Failed to delete global posted message ${entry.discord_message_id}: ${error?.message}`);
			results.push({ post_id: entry.id, ok: false, error: `${entry.server_name}: ${panelReason(error, entry.channel_name)}` });
		}
	}
	return { ok: true, results };
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
	if (!isSelfAssignableRole(role.permissions?.bitfield)) return 'unsafe';
	if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) return 'no_permission';
	if (!role.editable) return 'above_bot';
	return null;
}

async function applyRoles(interaction: any, actions: RoleAction[], tr: Translator): Promise<string[]> {
	if (actions.length === 0) return [];
	const guild = interaction.guild;
	const member = await guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) return [tr('common.errors.memberNotFound')];

	const lines: string[] = [];
	for (const action of actions) {
		const role = guild.roles.cache.get(action.role_id) ?? (await guild.roles.fetch(action.role_id).catch(() => null));
		const mention = `<@&${action.role_id}>`;
		const block = roleBlock(guild, role);
		if (block) {
			lines.push(tr(`messages.blocked.${block}`, { role: mention }));
			continue;
		}
		const has = member.roles.cache.has(role.id);
		const give = action.mode === 'add' || (action.mode === 'toggle' && !has);
		if (give === has) {
			lines.push(tr(give ? 'messages.roleAlready' : 'messages.roleNotHeld', { role: mention }));
			continue;
		}
		try {
			if (give) await member.roles.add(role.id, 'Message button');
			else await member.roles.remove(role.id, 'Message button');
			lines.push(tr(give ? 'messages.roleAdded' : 'messages.roleRemoved', { role: mention }));
		} catch (error: any) {
			await logger.log(`❌ Message button could not change role ${action.role_id} for ${interaction.user.id}: ${error?.message}`);
			lines.push(tr('messages.roleFailed', { role: mention, reason: errorReasonFor(tr, error) }));
		}
	}
	return lines;
}

function roleCooldownLeft(guildId: string, userId: string): number {
	const key = `${guildId}:${userId}`;
	const now = Date.now();
	const until = roleCooldowns.get(key) ?? 0;
	if (until > now) return until - now;
	if (roleCooldowns.size >= ROLE_COOLDOWN_SWEEP_AT) {
		for (const [entry, expires] of roleCooldowns) if (expires <= now) roleCooldowns.delete(entry);
	}
	roleCooldowns.set(key, now + ROLE_COOLDOWN_MS);
	return 0;
}

async function memberLanguage(serverId: number, userId: string, fallback: ServerLanguage): Promise<ServerLanguage> {
	const member = await db.getMemberByDiscordId(serverId, userId).catch(() => null);
	return isServerLanguage(member?.language) ? member.language : fallback;
}

export function isMessageComponentId(customId: unknown): boolean {
	return parseMessageCustomId(customId) !== null;
}

export async function handleMessageComponent(interaction: any) {
	const ref = parseMessageCustomId(interaction.customId);
	if (!ref || !interaction.guild) return;

	const guild = interaction.guild;
	const server = await getServerForCurrentBot(guild.id);
	const switching = ref.partId === MESSAGE_LANGUAGE_PART;
	const fromMenu = Array.isArray(interaction.values);
	const chosen = switching && fromMenu ? interaction.values[0] : ref.lang;
	const lang: ServerLanguage = switching
		? isServerLanguage(chosen)
			? chosen
			: ref.lang
		: ref.pinned
			? ref.lang
			: await memberLanguage(server.id, interaction.user.id, ref.lang);
	const pinned = switching || ref.pinned;
	const tr = translatorFor(lang);
	const privately = (content: string) => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });

	const panel = ref.scope === 'global' ? await currentPanelId() : null;
	const load = (id: number) => (ref.scope === 'global' ? (panel == null ? null : db.getGlobalMessage(panel, id)) : db.getServerMessage(server.id, id));
	const defaults = ref.scope === 'global' ? { defaultColor: await serverColor(guild.id) } : {};

	const message = await load(ref.messageId);
	const component = message && !switching ? findMessageComponent(message.content, ref.partId) : null;
	if (!message || (!switching && !component)) {
		await interaction.reply(privately(tr('messages.unavailable')));
		return;
	}

	const picked: string[] = fromMenu ? interaction.values : [];
	const actions = !component
		? []
		: component.kind === 'button'
			? component.button.actions
			: component.select.options.filter((o) => picked.includes(o.id)).flatMap((o) => o.actions);
	const show = actions.find((a): a is ShowAction => a.type === 'show');
	const roles = ref.scope === 'server' ? actions.filter((a): a is RoleAction => a.type === 'role') : [];
	if (!switching && !show && roles.length === 0) {
		await interaction.reply(privately(tr('messages.notSetUp')));
		return;
	}

	const target = switching ? message : show ? await load(show.message_id) : null;
	const rendered = target ? renderer(ref.scope, target, guild.name, defaults)(switching ? postLanguage(target.content, lang) : lang, { pinned }) : null;
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
		} else lines.push(tr('messages.unavailable'));
		acknowledged = true;
	} else if (fromMenu) {
		const posts: ServerMessagePost[] =
			ref.scope === 'global'
				? panel == null
					? []
					: await db.getGlobalMessagePosts(panel, message.id, currentBotId())
				: await db.getServerMessagePosts(server.id, message.id);
		const prefix = posts.find((entry) => entry.discord_message_id === source.id)?.mentions ?? '';
		const again = renderer(ref.scope, message, guild.name, defaults)(ref.lang, { prefix, pinned: ref.pinned });
		await interaction.update(again.v2 ? { components: again.components, flags: MessageFlags.IsComponentsV2 } : { components: again.components });
		acknowledged = true;
	}

	if ((show || switching) && !shown) lines.push(tr('messages.unavailable'));
	if (shown && !inPlace) {
		if (!acknowledged && shown.files.length > 0) {
			await interaction.deferReply({ flags: MessageFlags.Ephemeral });
			pendingReply = true;
		}
		const files = await loadFiles(shown).catch(() => null);
		if (!files) lines.push(tr('messages.unavailable'));
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

	const wait = roles.length > 0 ? roleCooldownLeft(guild.id, interaction.user.id) : 0;
	if (wait > 0) {
		const time = new Intl.NumberFormat(lang, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(Math.ceil(wait / 1000));
		lines.push(tr('messages.cooldown', { time }));
	} else lines.push(...(await applyRoles(interaction, roles, tr)));
	if (lines.length === 0) return;
	const result = { content: lines.join('\n'), allowedMentions: { parse: [] } };
	if (pendingReply) await interaction.editReply(result);
	else await interaction.followUp({ ...result, flags: MessageFlags.Ephemeral });
}
