import { MessageFlags, PermissionFlagsBits, RESTJSONErrorCodes } from 'discord.js';
import db, { type ServerMessage, type ServerMessagePost } from '../../../../database.js';
import { NOTIFICATIONS, getBotConfig, getEmbedConfig, getServerForCurrentBot, publicSiteOrigin } from '../../../config.js';
import { logger, attempt } from '../../../../utils/index.js';
import {
	MESSAGE_LANGUAGE_PART,
	MESSAGE_LIMITS,
	findMessageComponent,
	isMessageUploadKey,
	isSelfAssignableRole,
	messagePayloadTextLength,
	messageReplyDoc,
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
import type { Guild, GuildTextBasedChannel, InteractionReplyOptions, Message, MessageComponentInteraction, Role, Client } from 'discord.js';
import { SECOND_MS } from '../../../../utils/time.js';

type RoleAction = Extract<MessageAction, { type: 'role' }>;
type ShowAction = Extract<MessageAction, { type: 'show' }>;
type RoleBlock = 'deleted' | 'managed' | 'unsafe' | 'no_permission' | 'above_bot';
type LoadedFile = { attachment: Buffer; name: string };
type RenderExtra = { prefix?: string; interactive?: boolean; pinned?: boolean; defaultColor?: number | null; media?: boolean; post?: number | null };
type Renderer = (lang: ServerLanguage, extra?: RenderExtra) => MessagePayload;
type ComponentInteraction = MessageComponentInteraction<'cached'> & { values?: string[] };
type ErrorLike = { code?: unknown; message?: unknown } | null | undefined;
type SyncResult = { post_id: number; channel_id: string; channel_name: string; ok: boolean; gone?: boolean; error?: string };

const REJECTION_DETAIL_MAX_LENGTH = 300;
const REFUSAL_DETAIL_MAX_LENGTH = 200;
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
	if (!isMessageUploadKey(value)) {
		return value;
	}
	const url = messageFileUrl(value);
	return url.startsWith('/') ? publicSiteOrigin() + url : url;
}

type RenderTarget = { server: string; defaults?: RenderExtra };

function renderer(scope: MessageScope, message: ServerMessage, { server, defaults = {} }: RenderTarget): Renderer {
	return (lang, extra = {}) => renderMessagePayload(message.content, { scope, messageId: message.id, lang, server, image: imageUrl, ...defaults, ...extra });
}

async function loadFiles(payload: MessagePayload): Promise<LoadedFile[]> {
	const files: LoadedFile[] = [];
	for (const file of payload.files) {
		const data = await readMessageFile(file.key);
		if (!data) {
			throw Object.assign(new Error(`Uploaded file ${file.key} is missing from storage`), { code: FILE_MISSING });
		}
		files.push({ attachment: data, name: file.name });
	}
	return files;
}

function postLanguage(doc: MessageDoc, value: unknown): ServerLanguage {
	return isServerLanguage(value) && doc.languages.includes(value) ? value : doc.language;
}

function sendBody(payload: MessagePayload, files: LoadedFile[]): Record<string, unknown> {
	if (payload.v2) {
		return { components: payload.components, flags: MessageFlags.IsComponentsV2, files };
	}
	return { ...(payload.content ? { content: payload.content } : {}), embeds: payload.embeds, components: payload.components, files };
}

function privateBody(payload: MessagePayload, files: LoadedFile[]): Record<string, unknown> {
	return { ...sendBody(payload, files), flags: MessageFlags.Ephemeral | (payload.v2 ? MessageFlags.IsComponentsV2 : 0) };
}

function editBody(payload: MessagePayload, wasV2: boolean): Record<string, unknown> {
	if (!payload.v2) {
		return { content: payload.content, embeds: payload.embeds, components: payload.components };
	}
	const body = { components: payload.components, flags: MessageFlags.IsComponentsV2 };
	return wasV2 ? body : { ...body, content: null, embeds: [] };
}

function sameFiles(message: Message, payload: MessagePayload): boolean {
	const current = [...message.attachments.values()].map((attachment) => String(attachment.name));
	return current.length === payload.files.length && payload.files.every((file, i) => file.name === current[i]);
}

function showsMedia(message: Message): boolean {
	if (message.attachments.size > 0) {
		return true;
	}
	if (message.embeds.some((embed) => embed.image || embed.thumbnail)) {
		return true;
	}
	return /"type":1[12][,}]/.test(JSON.stringify(message.components));
}

function prefixFits(payload: MessagePayload, prefix: string): boolean {
	if (payload.v2) {
		return messagePayloadTextLength(payload) + prefix.length <= MESSAGE_LIMITS.blockText && payload.components.length < MESSAGE_LIMITS.components;
	}
	return (payload.content?.length ?? 0) + prefix.length + 1 <= MESSAGE_LIMITS.text;
}

function panelReason(error: unknown, channelName: string): string {
	const code = (error as ErrorLike)?.code;
	if (code === RESTJSONErrorCodes.MissingAccess) {
		return `The bot can't see #${channelName}. Give its role View Channel there.`;
	}
	if (code === RESTJSONErrorCodes.MissingPermissions) {
		return `The bot can't post in #${channelName}. Give its role Send Messages, Embed Links and Attach Files there.`;
	}
	if (code === RESTJSONErrorCodes.UnknownChannel) {
		return `#${channelName} no longer exists.`;
	}
	if (code === RESTJSONErrorCodes.RequestEntityTooLarge) {
		return `A file is over this server's upload limit. Discord sets it from the server's boost level. Use a smaller file.`;
	}
	if (code === FILE_MISSING) {
		return 'An uploaded file is missing from storage. Remove it from the message and upload it again.';
	}
	if (code === RESTJSONErrorCodes.InvalidFormBodyOrContentType) {
		return `Discord rejected the message: ${String((error as ErrorLike)?.message ?? 'invalid content').slice(0, REJECTION_DETAIL_MAX_LENGTH)}`;
	}
	return `Discord refused it (${String((error as ErrorLike)?.message ?? 'unknown error').slice(0, REFUSAL_DETAIL_MAX_LENGTH)}). Try again in a moment.`;
}

async function resolveGuild(client: Client, guildId: string) {
	return client.guilds.cache.get(guildId) ?? (await client.guilds.fetch(guildId).catch(() => null));
}

function roleMentions(guild: Guild, roleIds: unknown): string {
	const out: string[] = [];
	for (const id of Array.isArray(roleIds) ? roleIds.map(String) : []) {
		if (id === 'everyone') {
			out.push('@everyone');
		} else if (id === 'here') {
			out.push('@here');
		} else if (guild.roles.cache.has(id)) {
			out.push(`<@&${id}>`);
		}
	}
	return out.join(' ');
}

function groupMentions(guild: Guild, groups: unknown, staffRoles: unknown): string {
	const wanted = Array.isArray(groups) ? groups.map(String) : [];
	const out: string[] = [];
	if (wanted.includes('everyone')) {
		out.push('@everyone');
	}
	if (wanted.includes('here')) {
		out.push('@here');
	}
	const roleIds = new Set<string>();
	if (wanted.includes('admin')) {
		for (const role of guild.roles.cache.values()) {
			if (role.id !== guild.id && !role.managed && role.permissions?.has?.(PermissionFlagsBits.Administrator)) {
				roleIds.add(String(role.id));
			}
		}
	}
	if (wanted.includes('staff')) {
		for (const id of Array.isArray(staffRoles) ? staffRoles : []) {
			if (id) {
				roleIds.add(String(id));
			}
		}
	}
	return [...out, ...[...roleIds].map((id) => `<@&${id}>`)].join(' ');
}

type PostContent = { lang: ServerLanguage; files: LoadedFile[]; mentions: string };

async function post(channel: GuildTextBasedChannel, render: Renderer, { lang, files, mentions }: PostContent) {
	const chunks = (await NOTIFICATIONS.getNotifiedMemberMentionsForChannel(channel.guild.id, channel.id).catch(() => null)) ?? [];
	const prefix = [mentions, chunks[0]].filter(Boolean).join(' ');
	const plain = render(lang);
	const isInline = prefix !== '' && prefixFits(plain, prefix);
	const sent = await channel.send(sendBody(isInline ? render(lang, { prefix }) : plain, files));
	for (const extra of isInline ? chunks.slice(1) : [prefix, ...chunks.slice(1)]) {
		if (extra) {
			await channel.send({ content: extra }).catch(() => null);
		}
	}
	return { message_id: String(sent.id), mentions: isInline ? prefix : null };
}

type PostSync = { doc: MessageDoc; render: Renderer; interactive: boolean };

async function syncPost(guild: Guild, entry: ServerMessagePost, { doc, render, interactive: isInteractive }: PostSync): Promise<SyncResult> {
	const base = { post_id: entry.id, channel_id: entry.discord_channel_id, channel_name: entry.channel_name };
	try {
		const channel = await guild.channels.fetch(entry.discord_channel_id).catch((error: unknown) => {
			if ((error as ErrorLike)?.code === RESTJSONErrorCodes.UnknownChannel) {
				return null;
			}
			throw error;
		});
		const posted = channel?.isTextBased()
			? await channel.messages.fetch(entry.discord_message_id).catch((error: unknown) => {
					if ((error as ErrorLike)?.code === RESTJSONErrorCodes.UnknownMessage) {
						return null;
					}
					throw error;
				})
			: null;
		if (!posted) {
			return { ...base, ok: true, gone: true };
		}

		const wasV2 = posted.flags.has(MessageFlags.IsComponentsV2);
		const rendered = render(postLanguage(doc, entry.language), { prefix: entry.mentions ?? '', interactive: isInteractive });
		if (rendered.empty) {
			if (isInteractive) {
				return { ...base, ok: false, error: 'This message has nothing left to show. Add something to it, or remove the posted copies.' };
			}
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
	} catch (error) {
		await logger.log(`❌ Failed to update posted message ${entry.discord_message_id}: ${(error as Error)?.message}`);
		return { ...base, ok: false, error: panelReason(error, entry.channel_name) };
	}
}

async function removePosted(guild: Guild, channelId: string, discordMessageId: string) {
	const channel = await guild.channels.fetch(channelId).catch(() => null);
	const posted = channel?.isTextBased() ? await channel.messages.fetch(discordMessageId).catch(() => null) : null;
	if (posted) {
		await posted.delete();
	}
}

async function serverColor(guildId: string): Promise<number | null> {
	const config = await getEmbedConfig(guildId).catch(() => null);
	return config && Number.isFinite(config.COLOR) ? config.COLOR : null;
}

export async function sendServerMessage(client: Client, payload: Record<string, unknown>) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) {
		return { ok: false, error: 'The bot is not in this server.' };
	}
	const message = await db.getServerMessage(payload.server_id as number | string, payload.message_id as number | string);
	if (!message) {
		return { ok: false, error: 'That message no longer exists.' };
	}

	const lang = postLanguage(message.content, payload.language);
	const render = renderer('server', message, { server: guild.name });
	if (render(lang).empty) {
		return { ok: false, error: 'This message has nothing to send yet.' };
	}

	const filesResult = await attempt(() => loadFiles(render(lang)));
	if (!filesResult.ok) {
		await logger.log(`❌ Failed to load files for message ${message.id}: ${(filesResult.error as Error)?.message}`);
		return { ok: false, error: panelReason(filesResult.error, '') };
	}
	const files = filesResult.value;

	const mentions = roleMentions(guild, payload.role_ids);
	const results: { channel_id: string; ok: boolean; message_id?: string; mentions?: string | null; error?: string }[] = [];
	for (const channelId of Array.isArray(payload.channel_ids) ? payload.channel_ids.map(String) : []) {
		const channel = await guild.channels.fetch(channelId).catch(() => null);
		if (!channel || !channel.isTextBased()) {
			results.push({ channel_id: channelId, ok: false, error: 'That channel no longer exists or is not a text channel.' });
			continue;
		}
		try {
			results.push({ channel_id: channelId, ok: true, ...(await post(channel, render, { lang, files, mentions })) });
			await logger.log(`📤 Message "${message.name}" sent to #${channel.name} (${channel.id}) in ${guild.name} (${guild.id})`);
		} catch (error) {
			await logger.log(`❌ Failed to send message ${message.id} to channel ${channelId}: ${(error as Error)?.message}`);
			results.push({ channel_id: channelId, ok: false, error: panelReason(error, channel.name ?? channelId) });
		}
	}

	return { ok: true, results };
}

export async function syncServerMessagePosts(client: Client, payload: Record<string, unknown>) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) {
		return { ok: false, error: 'The bot is not in this server.' };
	}
	const message = await db.getServerMessage(payload.server_id as number | string, payload.message_id as number | string);
	if (!message) {
		return { ok: false, error: 'That message no longer exists.' };
	}

	const shouldRefresh = payload.refresh === true;
	const wanted = Array.isArray(payload.post_ids) ? new Set(payload.post_ids.map(Number)) : null;
	const results: SyncResult[] = [];
	for (const entry of await db.getServerMessagePosts(payload.server_id as number | string, message.id)) {
		if (wanted && !wanted.has(entry.id)) {
			continue;
		}
		const content = shouldRefresh ? message.content : (entry.content ?? message.content);
		const result = await syncPost(guild, entry, {
			doc: content,
			render: renderer('server', { ...message, content }, { server: guild.name }),
			interactive: payload.interactive !== false
		});
		if (shouldRefresh && result.ok && !result.gone) {
			await db.setServerMessagePostContent(payload.server_id as number | string, entry.id, content).catch(() => null);
		}
		results.push(result);
	}
	return { ok: true, results };
}

export async function removeServerMessagePost(client: Client, payload: Record<string, unknown>) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) {
		return { ok: false, error: 'The bot is not in this server.' };
	}
	try {
		await removePosted(guild, String(payload.channel_id), String(payload.discord_message_id));
		return { ok: true };
	} catch (error) {
		await logger.log(`❌ Failed to delete posted message ${payload.discord_message_id}: ${(error as Error)?.message}`);
		return { ok: false, error: panelReason(error, String(payload.channel_name ?? payload.channel_id)) };
	}
}

export async function sendGlobalMessage(client: Client, payload: Record<string, unknown>) {
	const panel = await currentPanelId();
	const message = panel == null ? null : await db.getGlobalMessage(panel, payload.message_id as number | string);
	if (!message) {
		return { ok: false, error: 'That message no longer exists.' };
	}

	const filesResult = await attempt(() => loadFiles(renderer('global', message, { server: '' })(message.content.language)));
	if (!filesResult.ok) {
		await logger.log(`❌ Failed to load files for global message ${message.id}: ${(filesResult.error as Error)?.message}`);
		return { ok: false, error: panelReason(filesResult.error, '') };
	}
	const files = filesResult.value;

	const results: Record<string, unknown>[] = [];
	for (const server of await db.getServersForBot(currentBotId())) {
		const base = { server_id: server.id, server_name: String(server.name ?? 'Server') };
		try {
			const row = await db.getServerSettings(server.id, 'main').catch(() => null);
			const settings: Record<string, unknown> = (Array.isArray(row) ? row[0]?.settings : row?.settings) ?? {};
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
			const render = renderer('global', message, { server: guild.name, defaults: { defaultColor: await serverColor(guild.id) } });
			if (render(lang).empty) {
				results.push({ ...base, ok: false, error: 'This message has nothing to send yet.' });
				continue;
			}
			const sent = await post(channel, render, { lang, files, mentions: groupMentions(guild, payload.mention_groups, settings.staff_roles) });
			results.push({ ...base, ok: true, channel_id: channelId, language: lang, ...sent });
			await logger.log(`📤 Global message "${message.name}" sent to #${channel.name} in ${guild.name} (${guild.id})`);
		} catch (error) {
			await logger.log(`❌ Failed to send global message ${message.id} to server ${server.id}: ${(error as Error)?.message}`);
			results.push({ ...base, ok: false, error: panelReason(error, 'bot-updates') });
		}
	}

	return { ok: true, results };
}

export async function syncGlobalMessagePosts(client: Client, payload: Record<string, unknown>) {
	const panel = await currentPanelId();
	const message = panel == null ? null : await db.getGlobalMessage(panel, payload.message_id as number | string);
	if (!message || panel == null) {
		return { ok: false, error: 'That message no longer exists.' };
	}

	const shouldRefresh = payload.refresh === true;
	const wanted = Array.isArray(payload.post_ids) ? new Set(payload.post_ids.map(Number)) : null;
	const results: SyncResult[] = [];
	for (const entry of await db.getGlobalMessagePosts(panel, message.id, currentBotId())) {
		if (wanted && !wanted.has(entry.id)) {
			continue;
		}
		const guild = await resolveGuild(client, entry.discord_server_id);
		if (!guild) {
			results.push({ post_id: entry.id, channel_id: entry.discord_channel_id, channel_name: entry.channel_name, ok: true, gone: true });
			continue;
		}
		const content = shouldRefresh ? message.content : (entry.content ?? message.content);
		const render = renderer('global', { ...message, content }, { server: guild.name, defaults: { defaultColor: await serverColor(guild.id) } });
		const result = await syncPost(guild, entry, { doc: content, render, interactive: payload.interactive !== false });
		if (shouldRefresh && result.ok && !result.gone) {
			await db.setGlobalMessagePostContent(panel, entry.id, content).catch(() => null);
		}
		results.push(result);
	}
	return { ok: true, results };
}

export async function removeGlobalMessagePosts(client: Client, payload: Record<string, unknown>) {
	const panel = await currentPanelId();
	if (panel == null) {
		return { ok: false, error: 'This bot has no panel.' };
	}
	const wanted = new Set((Array.isArray(payload.post_ids) ? payload.post_ids : []).map(Number));
	const results: { post_id: number; ok: boolean; error?: string }[] = [];
	for (const entry of await db.getGlobalMessagePosts(panel, Number(payload.message_id), currentBotId())) {
		if (!wanted.has(entry.id)) {
			continue;
		}
		try {
			const guild = await resolveGuild(client, entry.discord_server_id);
			if (guild) {
				await removePosted(guild, entry.discord_channel_id, entry.discord_message_id);
			}
			results.push({ post_id: entry.id, ok: true });
		} catch (error) {
			await logger.log(`❌ Failed to delete global posted message ${entry.discord_message_id}: ${(error as Error)?.message}`);
			results.push({ post_id: entry.id, ok: false, error: `${entry.server_name}: ${panelReason(error, entry.channel_name)}` });
		}
	}
	return { ok: true, results };
}

export async function listGuildEmojis(client: Client, payload: Record<string, unknown>) {
	const guild = await resolveGuild(client, String(payload.guild_id));
	if (!guild) {
		return { ok: false, emojis: [] };
	}
	const emojis = (await guild.emojis.fetch().catch(() => null)) ?? guild.emojis.cache;
	return {
		ok: true,
		emojis: [...emojis.values()]
			.filter((emoji) => emoji.available !== false && emoji.name)
			.map((emoji) => ({ id: String(emoji.id), name: String(emoji.name), animated: emoji.animated === true }))
	};
}

function roleBlock(guild: Guild, role: Role | null): RoleBlock | null {
	if (!role) {
		return 'deleted';
	}
	if (role.managed) {
		return 'managed';
	}
	if (!isSelfAssignableRole(role.permissions?.bitfield)) {
		return 'unsafe';
	}
	if (!guild.members.me?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
		return 'no_permission';
	}
	if (!role.editable) {
		return 'above_bot';
	}
	return null;
}

async function applyRoles(interaction: ComponentInteraction, actions: RoleAction[], tr: Translator): Promise<string[]> {
	if (actions.length === 0) {
		return [];
	}
	const { guild } = interaction;
	const member = await guild.members.fetch(interaction.user.id).catch(() => null);
	if (!member) {
		return [tr('common.errors.memberNotFound')];
	}

	const lines: string[] = [];
	for (const action of actions) {
		const role = guild.roles.cache.get(action.role_id) ?? (await guild.roles.fetch(action.role_id).catch(() => null));
		const mention = `<@&${action.role_id}>`;
		const block = roleBlock(guild, role);
		if (block) {
			lines.push(tr(`messages.blocked.${block}`, { role: mention }));
			continue;
		}
		const hasRole = member.roles.cache.has(role!.id);
		const shouldGive = action.mode === 'add' || (action.mode === 'toggle' && !hasRole);
		if (shouldGive === hasRole) {
			lines.push(tr(shouldGive ? 'messages.roleAlready' : 'messages.roleNotHeld', { role: mention }));
			continue;
		}
		try {
			if (shouldGive) {
				await member.roles.add(role!.id, 'Message button');
			} else {
				await member.roles.remove(role!.id, 'Message button');
			}
			lines.push(tr(shouldGive ? 'messages.roleAdded' : 'messages.roleRemoved', { role: mention }));
		} catch (error) {
			await logger.log(`❌ Message button could not change role ${action.role_id} for ${interaction.user.id}: ${(error as Error)?.message}`);
			lines.push(tr('messages.roleFailed', { role: mention, reason: errorReasonFor(tr, error) }));
		}
	}
	return lines;
}

function roleCooldownLeft(guildId: string, userId: string): number {
	const key = `${guildId}:${userId}`;
	const now = Date.now();
	const until = roleCooldowns.get(key) ?? 0;
	if (until > now) {
		return until - now;
	}
	if (roleCooldowns.size >= ROLE_COOLDOWN_SWEEP_AT) {
		for (const [entry, expires] of roleCooldowns) {
			if (expires <= now) {
				roleCooldowns.delete(entry);
			}
		}
	}
	roleCooldowns.set(key, now + ROLE_COOLDOWN_MS);
	return 0;
}

async function memberLanguage(serverId: number, userId: string, fallback: ServerLanguage): Promise<ServerLanguage> {
	const member = await db.getMemberByDiscordId(serverId, userId).catch(() => null);
	return isServerLanguage(member?.language) ? member.language : fallback;
}

export function isMessageComponentId(customId: string): boolean {
	return parseMessageCustomId(customId) !== null;
}

type MessageRef = NonNullable<ReturnType<typeof parseMessageCustomId>>;
type ComponentScene = {
	ref: MessageRef;
	guild: Guild;
	serverId: number;
	lang: ServerLanguage;
	isSwitching: boolean;
	isFromMenu: boolean;
	isPinned: boolean;
	tr: Translator;
	panel: number | null;
	defaults: RenderExtra;
};
type SceneMessage = { message: ServerMessage | null; post: ServerMessagePost | null; component: ReturnType<typeof findMessageComponent> | null };

async function componentScene(interaction: ComponentInteraction, ref: MessageRef): Promise<ComponentScene> {
	const { guild } = interaction;
	const server = await getServerForCurrentBot(guild.id);
	const isSwitching = ref.partId === MESSAGE_LANGUAGE_PART;
	const isFromMenu = Array.isArray(interaction.values);
	const chosen = isSwitching && isFromMenu ? interaction.values![0] : ref.lang;
	const memberLang = isSwitching || ref.pinned ? ref.lang : await memberLanguage(server.id, interaction.user.id, ref.lang);
	const lang: ServerLanguage = isSwitching && isServerLanguage(chosen) ? chosen : memberLang;
	return {
		ref,
		guild,
		serverId: server.id,
		lang,
		isSwitching,
		isFromMenu,
		isPinned: isSwitching || ref.pinned,
		tr: translatorFor(lang),
		panel: ref.scope === 'global' ? await currentPanelId() : null,
		defaults: ref.scope === 'global' ? { defaultColor: await serverColor(guild.id) } : {}
	};
}

function loadSceneMessage(scene: ComponentScene, id: number) {
	if (scene.ref.scope !== 'global') {
		return db.getServerMessage(scene.serverId, id);
	}
	return scene.panel == null ? null : db.getGlobalMessage(scene.panel, id);
}

async function scenePosts(scene: ComponentScene, template: ServerMessage | null): Promise<ServerMessagePost[]> {
	if (!template) {
		return [];
	}
	if (scene.ref.scope !== 'global') {
		return db.getServerMessagePosts(scene.serverId, template.id);
	}
	return scene.panel == null ? [] : db.getGlobalMessagePosts(scene.panel, template.id, currentBotId());
}

async function sceneMessage(scene: ComponentScene, source: Message): Promise<SceneMessage> {
	const template = await loadSceneMessage(scene, scene.ref.messageId);
	const posts = await scenePosts(scene, template);
	const { ref } = scene;
	const post = posts.find((entry) => (ref.post != null ? entry.id === ref.post : entry.discord_message_id === source.id)) ?? null;
	const message = template && post?.content ? { ...template, content: post.content } : template;
	const component = message && !scene.isSwitching ? findMessageComponent(message.content, ref.partId) : null;
	return { message, post, component };
}

function componentActions(component: SceneMessage['component'], picked: string[]): MessageAction[] {
	if (!component) {
		return [];
	}
	return component.kind === 'button' ? component.button.actions : component.select.options.filter((o) => picked.includes(o.id)).flatMap((o) => o.actions);
}

function shownPayload(scene: ComponentScene, { target, post, source }: { target: ServerMessage | null; post: ServerMessagePost | null; source: Message }) {
	const isSourceV2 = source.flags.has(MessageFlags.IsComponentsV2);
	const defaults = scene.isSwitching && post ? { ...scene.defaults, post: post.id } : scene.defaults;
	const render = target ? renderer(scene.ref.scope, target, { server: scene.guild.name, defaults }) : null;
	const shownLanguage = scene.isSwitching && target ? postLanguage(target.content, scene.lang) : scene.lang;
	const hasNoMedia = scene.isSwitching && (!source.flags.has(MessageFlags.Ephemeral) || !showsMedia(source));
	const lean = render && hasNoMedia ? render(shownLanguage, { pinned: scene.isPinned, media: false }) : null;
	const rendered = lean && !lean.empty ? lean : render ? render(shownLanguage, { pinned: scene.isPinned }) : null;
	const shown = rendered && !rendered.empty ? rendered : null;
	return { shown, isSourceV2, isInPlace: !!shown && source.flags.has(MessageFlags.Ephemeral) && (shown.v2 || !isSourceV2) };
}

class ComponentResponder {
	readonly lines: string[] = [];
	private readonly interaction: ComponentInteraction;
	private readonly tr: Translator;
	private isAcknowledged = false;
	private isReplyPending = false;

	constructor(interaction: ComponentInteraction, tr: Translator) {
		this.interaction = interaction;
		this.tr = tr;
	}

	async showInPlace(shown: MessagePayload, isSourceV2: boolean) {
		const isSlow = shown.files.length > 0;
		if (isSlow) {
			await this.interaction.deferUpdate();
		}
		const files = await loadFiles(shown).catch(() => null);
		if (files) {
			const body = { ...editBody(shown, isSourceV2), files, attachments: [] };
			await (isSlow ? this.interaction.editReply(body) : this.interaction.update(body));
		} else {
			this.lines.push(this.tr('messages.unavailable'));
		}
		this.isAcknowledged = true;
	}

	async refreshMenu(again: MessagePayload) {
		await this.interaction.update(again.v2 ? { components: again.components, flags: MessageFlags.IsComponentsV2 } : { components: again.components });
		this.isAcknowledged = true;
	}

	async sendPrivately(payload: MessagePayload) {
		if (!this.isAcknowledged && payload.files.length > 0) {
			await this.interaction.deferReply({ flags: MessageFlags.Ephemeral });
			this.isReplyPending = true;
		}
		const files = await loadFiles(payload).catch(() => null);
		if (!files) {
			this.lines.push(this.tr('messages.unavailable'));
		} else if (this.isReplyPending) {
			await this.interaction.editReply(sendBody(payload, files));
			this.isReplyPending = false;
		} else if (this.isAcknowledged) {
			await this.interaction.followUp(privateBody(payload, files));
		} else {
			await this.interaction.reply(privateBody(payload, files));
		}
		this.isAcknowledged = true;
	}

	async ensureAcknowledged() {
		if (!this.isAcknowledged) {
			await this.interaction.deferReply({ flags: MessageFlags.Ephemeral });
			this.isReplyPending = true;
			this.isAcknowledged = true;
		}
	}

	async finish() {
		if (this.lines.length === 0) {
			return;
		}
		const result = { content: this.lines.join('\n'), allowedMentions: { parse: [] } };
		if (this.isReplyPending) {
			await this.interaction.editReply(result);
		} else {
			await this.interaction.followUp({ ...result, flags: MessageFlags.Ephemeral });
		}
	}
}

async function roleActionLines(interaction: ComponentInteraction, roles: RoleAction[], scene: ComponentScene): Promise<string[]> {
	const wait = roles.length > 0 ? roleCooldownLeft(scene.guild.id, interaction.user.id) : 0;
	if (wait <= 0) {
		return applyRoles(interaction, roles, scene.tr);
	}
	const time = new Intl.NumberFormat(scene.lang, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(Math.ceil(wait / SECOND_MS));
	return [scene.tr('messages.cooldown', { time })];
}

export async function handleMessageComponent(interaction: ComponentInteraction) {
	const ref = parseMessageCustomId(interaction.customId);
	if (!ref || !interaction.guild) {
		return;
	}

	const scene = await componentScene(interaction, ref);
	const { tr, isSwitching } = scene;
	const privately = (content: string): InteractionReplyOptions => ({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
	const source = interaction.message;
	const { message, post, component } = await sceneMessage(scene, source);
	if (!message || (!isSwitching && !component)) {
		await interaction.reply(privately(tr('messages.unavailable')));
		return;
	}

	const actions = componentActions(component, scene.isFromMenu ? interaction.values! : []);
	const show = actions.find((a): a is ShowAction => a.type === 'show');
	const roles = ref.scope === 'server' ? actions.filter((a): a is RoleAction => a.type === 'role') : [];
	const written = messageReplyDoc(actions, message.content);
	if (!isSwitching && !show && !written && roles.length === 0) {
		await interaction.reply(privately(tr('messages.notSetUp')));
		return;
	}

	const target = isSwitching ? message : show ? await loadSceneMessage(scene, show.message_id) : null;
	const { shown, isSourceV2, isInPlace } = shownPayload(scene, { target, post, source });
	const responder = new ComponentResponder(interaction, tr);

	if (isInPlace && shown) {
		await responder.showInPlace(shown, isSourceV2);
	} else if (scene.isFromMenu) {
		const prefix = ref.post == null ? (post?.mentions ?? '') : '';
		await responder.refreshMenu(
			renderer(ref.scope, message, { server: scene.guild.name, defaults: scene.defaults })(ref.lang, { prefix, pinned: ref.pinned, post: ref.post })
		);
	}

	if ((show || isSwitching) && !shown) {
		responder.lines.push(tr('messages.unavailable'));
	}
	if (shown && !isInPlace) {
		await responder.sendPrivately(shown);
	}
	if (written) {
		await responder.sendPrivately(renderer(ref.scope, { ...message, content: written }, { server: scene.guild.name })(scene.lang, { interactive: false }));
	}
	await responder.ensureAcknowledged();
	responder.lines.push(...(await roleActionLines(interaction, roles, scene)));
	await responder.finish();
}
