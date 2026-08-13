import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	EmbedBuilder,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuOptionBuilder
} from 'discord.js';
import { randomBytes } from 'crypto';
import db from '../../../../database.js';
import {
	DEFAULT_BOOSTER_MESSAGES,
	DEFAULT_BOT_NICKNAME,
	DEFAULT_LEVELING_SETTINGS,
	DEFAULT_WELCOMER_MESSAGES,
	DISCORD_GUILD_CATEGORY_LIMIT,
	DISCORD_GUILD_CHANNEL_LIMIT,
	SERVER_SETTINGS,
	SETUP_CHANNEL_DEFS,
	SETUP_MENU_CATEGORY_NAME,
	SETUP_MODULES,
	SETUP_OWNER_INVITE_TTL_MINUTES,
	SETUP_RECORD_VERSION,
	getBotConfig,
	getEmbedConfig,
	recommendedSetupModuleIds,
	setupChannelDefsForModules
} from '../../../config.js';
import { publicSiteOrigin } from '../../../../url.js';
import { isUtcSqlExpired, logger } from '../../../../utils/index.js';
import { translate } from '../i18n.js';
import syncComponent from './sync.js';

const COLOR_OK = 0x57f287;
const COLOR_WARN = 0xfee75c;
const COLOR_ERR = 0xed4245;
const COLOR_INFO = 0x5865f2;
const EPHEMERAL = 64;
const SELECTION_TTL_MS = 15 * 60 * 1000;
const PROGRESS_EVERY = 4;

type ChannelDef = (typeof SETUP_CHANNEL_DEFS)[number];

type SetupRecord = {
	version: number;
	category_id: string;
	channels: Record<string, string>;
	modules: string[];
	completed_at: string;
};

type ChannelStatus = { def: ChannelDef; id: string | null; channel: any | null; exists: boolean };

type SetupInspection = {
	state: 'fresh' | 'healthy' | 'partial';
	record: SetupRecord | null;
	category: any | null;
	statuses: ChannelStatus[];
	missing: ChannelStatus[];
	modules: string[];
	adopted: boolean;
};

type PreflightCheck = { label: string; ok: boolean; detail?: string };

type PreflightResult = {
	ok: boolean;
	checks: PreflightCheck[];
	server: any | null;
	botConfig: any | null;
	origin: string | null;
};

const REQUIRED_BOT_PERMISSIONS = [
	{ flag: PermissionFlagsBits.ManageChannels, name: 'Manage Channels' },
	{ flag: PermissionFlagsBits.ViewChannel, name: 'View Channels' },
	{ flag: PermissionFlagsBits.SendMessages, name: 'Send Messages' },
	{ flag: PermissionFlagsBits.EmbedLinks, name: 'Embed Links' }
];

const CHANNEL_BINDINGS: {
	settingsKey: string;
	component: string;
	read: (settings: Record<string, any>) => string | null;
	write: (channelId: string, settings: Record<string, any>) => Record<string, any>;
}[] = [
	{
		settingsKey: 'bot_updates',
		component: SERVER_SETTINGS.component.main,
		read: (s) => s.bot_updates_channel_id ?? null,
		write: (id) => ({ bot_updates_channel_id: id })
	},
	{
		settingsKey: 'leveling',
		component: SERVER_SETTINGS.component.leveling,
		read: (s) => s.PROGRESS_CHANNEL_ID ?? null,
		write: (id) => ({ PROGRESS_CHANNEL_ID: id })
	},
	{
		settingsKey: 'items',
		component: SERVER_SETTINGS.component.public_statistics,
		read: (s) => s.ITEMS_CHANNEL_ID ?? null,
		write: (id) => ({ ITEMS_CHANNEL_ID: id })
	},
	{
		settingsKey: 'minigames',
		component: SERVER_SETTINGS.component.public_statistics,
		read: (s) => s.MINIGAMES_CHANNEL_ID ?? null,
		write: (id) => ({ MINIGAMES_CHANNEL_ID: id })
	},
	{
		settingsKey: 'welcomer',
		component: SERVER_SETTINGS.component.welcomer,
		read: (s) => (Array.isArray(s.channels) ? (s.channels[0] ?? null) : null),
		write: (id, s) => ({ channels: Array.from(new Set([...(Array.isArray(s.channels) ? s.channels.map(String) : []), id])) })
	},
	{
		settingsKey: 'booster',
		component: SERVER_SETTINGS.component.booster,
		read: (s) => (Array.isArray(s.channels) ? (s.channels[0] ?? null) : null),
		write: (id, s) => ({ channels: Array.from(new Set([...(Array.isArray(s.channels) ? s.channels.map(String) : []), id])) })
	},
	{
		settingsKey: 'moderation',
		component: SERVER_SETTINGS.component.moderation,
		read: (s) => s.log_channel_id ?? null,
		write: (id) => ({ log_channel_id: id })
	},
	{
		settingsKey: 'giveaway',
		component: SERVER_SETTINGS.component.giveaway,
		read: (s) => s.giveaway_channel ?? null,
		write: (id) => ({ giveaway_channel: id })
	},
	{
		settingsKey: 'staff_rating',
		component: SERVER_SETTINGS.component.staff_rating,
		read: (s) => s.rating_channel_id ?? null,
		write: (id) => ({ rating_channel_id: id })
	},
	{
		settingsKey: 'discord_quest_notifier',
		component: SERVER_SETTINGS.component.discord_quest_notifier,
		read: (s) => s.channel_id ?? null,
		write: (id) => ({ channel_id: id })
	},
	{
		settingsKey: 'content_creator',
		component: SERVER_SETTINGS.component.content_creator,
		read: (s) => s.target_channel_id ?? null,
		write: (id) => ({ target_channel_id: id })
	},
	{
		settingsKey: 'roblox_catalog_notifier',
		component: SERVER_SETTINGS.component.roblox_catalog_notifier,
		read: (s) => s.channel_id ?? null,
		write: (id) => ({ channel_id: id })
	}
];

const MODULE_DEFAULTS: Record<string, Record<string, any>> = {
	[SERVER_SETTINGS.component.leveling]: { ...DEFAULT_LEVELING_SETTINGS },
	[SERVER_SETTINGS.component.welcomer]: { messages: DEFAULT_WELCOMER_MESSAGES },
	[SERVER_SETTINGS.component.booster]: { messages: DEFAULT_BOOSTER_MESSAGES },
	[SERVER_SETTINGS.component.public_statistics]: { items_enabled: true, minigames_enabled: true, assets_enabled: true }
};

const pendingSelections = new Map<string, { modules: string[]; at: number }>();
const inFlightGuilds = new Set<string>();

function selectionKey(guildId: string, userId: string) {
	return `${guildId}:${userId}`;
}

function purgeStaleSelections() {
	const now = Date.now();
	for (const [key, entry] of pendingSelections) {
		if (now - entry.at > SELECTION_TTL_MS) pendingSelections.delete(key);
	}
}

function setSelection(guildId: string, userId: string, modules: string[]) {
	purgeStaleSelections();
	pendingSelections.set(selectionKey(guildId, userId), { modules, at: Date.now() });
}

function getSelection(guildId: string, userId: string): string[] | null {
	const entry = pendingSelections.get(selectionKey(guildId, userId));
	if (!entry) return null;
	if (Date.now() - entry.at > SELECTION_TTL_MS) {
		pendingSelections.delete(selectionKey(guildId, userId));
		return null;
	}
	return entry.modules;
}

function clearSelection(guildId: string, userId: string) {
	pendingSelections.delete(selectionKey(guildId, userId));
}

function moduleById(moduleId: string) {
	return SETUP_MODULES.find((m) => m.id === moduleId) ?? null;
}

function moduleLabel(moduleId: string) {
	const mod = moduleById(moduleId);
	return mod ? `${mod.emoji} ${mod.label}` : moduleId;
}

function channelNamesForModule(moduleId: string) {
	return SETUP_CHANNEL_DEFS.filter((d) => d.moduleId === moduleId)
		.map((d) => d.name)
		.join(' ');
}

function normalizeModules(moduleIds: readonly string[]) {
	const valid = new Set(SETUP_MODULES.map((m) => m.id));
	const out = new Set<string>(['core']);
	for (const id of moduleIds) if (valid.has(id as any)) out.add(id);
	return Array.from(out);
}

function isSetupActor(interaction: any) {
	const isOwner = interaction.member?.id === interaction.guild?.ownerId;
	const hasAdministrator =
		interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator) ||
		interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator) ||
		false;
	return isOwner || hasAdministrator;
}

async function denySetupActor(interaction: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';
	const payload = {
		embeds: [
			new EmbedBuilder()
				.setColor(COLOR_ERR)
				.setTitle(await translate('interface.setup.notAllowedTitle', gid, uid))
				.setDescription(await translate('interface.setup.notAllowedBody', gid, uid))
		],
		flags: EPHEMERAL
	};
	if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds: payload.embeds }).catch(() => null);
	else await interaction.reply(payload).catch(() => null);
}

async function readSettings(serverId: number, component: string): Promise<Record<string, any>> {
	const row = await db.getServerSettings(serverId, component);
	return row?.settings && typeof row.settings === 'object' ? (row.settings as Record<string, any>) : {};
}

async function loadSetupRecord(serverId: number): Promise<SetupRecord | null> {
	const main = await readSettings(serverId, SERVER_SETTINGS.component.main);
	const rec = main.setup;
	if (!rec || typeof rec !== 'object') return null;
	if (!rec.category_id || !rec.channels || typeof rec.channels !== 'object') return null;
	return {
		version: Number(rec.version) || 1,
		category_id: String(rec.category_id),
		channels: Object.fromEntries(Object.entries(rec.channels).map(([k, v]) => [k, String(v)])),
		modules: Array.isArray(rec.modules) ? rec.modules.map(String) : [],
		completed_at: rec.completed_at ? String(rec.completed_at) : ''
	};
}

async function saveSetupRecord(serverId: number, record: SetupRecord) {
	const main = await readSettings(serverId, SERVER_SETTINGS.component.main);
	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.main, { ...main, setup: record });
}

async function deriveChannelIdsFromSettings(serverId: number) {
	const out: Record<string, string> = {};
	const cache = new Map<string, Record<string, any>>();
	for (const binding of CHANNEL_BINDINGS) {
		if (!cache.has(binding.component)) cache.set(binding.component, await readSettings(serverId, binding.component));
		const value = binding.read(cache.get(binding.component) as Record<string, any>);
		if (value) out[binding.settingsKey] = String(value);
	}
	return out;
}

async function adoptLegacySetup(guild: any, serverId: number): Promise<SetupRecord | null> {
	const derived = await deriveChannelIdsFromSettings(serverId);
	const resolved = Object.entries(derived).filter(([, id]) => guild.channels.cache.has(id));
	if (!resolved.length) return null;

	const parentCount = new Map<string, number>();
	for (const [, id] of resolved) {
		const parentId = guild.channels.cache.get(id)?.parentId;
		if (parentId) parentCount.set(parentId, (parentCount.get(parentId) ?? 0) + 1);
	}

	let categoryId: string | null = null;
	let best = 0;
	for (const [pid, count] of parentCount) {
		if (count > best) {
			best = count;
			categoryId = pid;
		}
	}
	if (!categoryId) return null;

	const channels: Record<string, string> = {};
	for (const [key, id] of resolved) channels[key] = id;

	const menuDef = SETUP_CHANNEL_DEFS.find((d) => d.settingsKey === 'menu');
	if (menuDef) {
		const menuChannel = guild.channels.cache.find((c: any) => c.parentId === categoryId && c.name === menuDef.name);
		if (menuChannel) channels.menu = menuChannel.id;
	}

	const modules = new Set<string>(['core']);
	for (const def of SETUP_CHANNEL_DEFS) if (channels[def.settingsKey]) modules.add(def.moduleId);

	return {
		version: 1,
		category_id: categoryId,
		channels,
		modules: Array.from(modules),
		completed_at: ''
	};
}

async function inspectSetup(guild: any, serverId: number): Promise<SetupInspection> {
	let record = await loadSetupRecord(serverId);
	let adopted = false;

	if (!record) {
		record = await adoptLegacySetup(guild, serverId);
		adopted = !!record;
	}

	if (!record) {
		return { state: 'fresh', record: null, category: null, statuses: [], missing: [], modules: [], adopted: false };
	}

	const category = guild.channels.cache.get(record.category_id) ?? null;
	const modules = record.modules.length ? normalizeModules(record.modules) : recommendedSetupModuleIds();
	const defs = setupChannelDefsForModules(modules);

	const statuses: ChannelStatus[] = defs.map((def) => {
		const id = record?.channels[def.settingsKey] ?? null;
		const channel = id ? (guild.channels.cache.get(id) ?? null) : null;
		return { def, id, channel, exists: !!channel };
	});

	const missing = statuses.filter((s) => !s.exists);
	const state = category && missing.length === 0 ? 'healthy' : 'partial';

	return { state, record, category, statuses, missing, modules, adopted };
}

async function applyModuleSettings(serverId: number, moduleIds: string[], channelMap: Record<string, string>) {
	const modules = normalizeModules(moduleIds);
	const activeKeys = new Set(setupChannelDefsForModules(modules).map((d) => d.settingsKey));

	const enabledComponents = new Set<string>();
	for (const moduleId of modules) if (moduleId !== 'core') enabledComponents.add(moduleId);

	const componentsTouched = new Set<string>(enabledComponents);
	for (const binding of CHANNEL_BINDINGS) {
		if (activeKeys.has(binding.settingsKey) && channelMap[binding.settingsKey]) componentsTouched.add(binding.component);
	}

	for (const component of componentsTouched) {
		const existing = await readSettings(serverId, component);
		const next: Record<string, any> = { ...(MODULE_DEFAULTS[component] ?? {}), ...existing };

		for (const binding of CHANNEL_BINDINGS) {
			if (binding.component !== component) continue;
			if (!activeKeys.has(binding.settingsKey)) continue;
			const id = channelMap[binding.settingsKey];
			if (!id) continue;
			Object.assign(next, binding.write(id, existing));
		}

		if (enabledComponents.has(component)) next.enabled = true;
		await db.upsertServerSettings(serverId, component, next);
	}

	const notifications = await readSettings(serverId, SERVER_SETTINGS.component.notifications);
	const existingNotifIds = Array.isArray(notifications.channel_ids) ? notifications.channel_ids.map(String) : [];
	const createdNotifIds = Object.entries(channelMap)
		.filter(([key]) => key !== 'menu')
		.map(([, id]) => String(id));

	await db.upsertServerSettings(serverId, SERVER_SETTINGS.component.notifications, {
		...notifications,
		enabled: true,
		channel_ids: Array.from(new Set([...existingNotifIds, ...createdNotifIds]))
	});
}

async function resolveBotName(guildId: string) {
	const embedConfig = await getEmbedConfig(guildId).catch(() => ({ NICKNAME: DEFAULT_BOT_NICKNAME }) as any);
	const name = typeof embedConfig?.NICKNAME === 'string' ? embedConfig.NICKNAME.trim() : '';
	return name || DEFAULT_BOT_NICKNAME;
}

function categoryNameFor(botName: string) {
	return SETUP_MENU_CATEGORY_NAME.replace('{botName}', botName);
}

async function runPreflight(interaction: any, guild: any, neededChannelCount: number): Promise<PreflightResult> {
	const gid = guild.id;
	const uid = interaction.user?.id ?? '';
	const checks: PreflightCheck[] = [];

	const botConfig = getBotConfig();
	checks.push({
		label: await translate('interface.setup.checkBotConfig', gid, uid),
		ok: !!botConfig,
		detail: botConfig ? undefined : await translate('interface.setup.detailNoBotConfig', gid, uid)
	});

	let server: any = null;
	if (botConfig) {
		server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
		if (!server) {
			await logger.log(`ℹ️ Setup: no server row for ${guild.name} (${guild.id}), upserting on demand`);
			server = await db.upsertOfficialServer(botConfig.id, guild).catch(() => null);
		}
	}
	checks.push({
		label: await translate('interface.setup.checkServer', gid, uid),
		ok: !!server,
		detail: server ? undefined : await translate('interface.setup.detailNoServer', gid, uid)
	});

	const origin = publicSiteOrigin();
	checks.push({
		label: await translate('interface.setup.checkBaseUrl', gid, uid),
		ok: !!origin,
		detail: origin ? undefined : await translate('interface.setup.detailNoBaseUrl', gid, uid)
	});

	const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
	const missingPerms: string[] = [];
	if (!me) {
		checks.push({
			label: await translate('interface.setup.checkPerms', gid, uid),
			ok: false,
			detail: await translate('interface.setup.detailBotMemberUnknown', gid, uid)
		});
	} else {
		for (const perm of REQUIRED_BOT_PERMISSIONS) if (!me.permissions.has(perm.flag)) missingPerms.push(perm.name);
		checks.push({
			label: await translate('interface.setup.checkPerms', gid, uid),
			ok: missingPerms.length === 0,
			detail: missingPerms.length ? await translate('interface.setup.detailMissingPerms', gid, uid, { perms: missingPerms.join(', ') }) : undefined
		});
	}

	const currentChannels = guild.channels.cache.size;
	const currentCategories = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildCategory).size;
	const needed = neededChannelCount + 1;
	const channelRoom = currentChannels + needed <= DISCORD_GUILD_CHANNEL_LIMIT;
	const categoryRoom = currentCategories + 1 <= DISCORD_GUILD_CATEGORY_LIMIT;
	checks.push({
		label: await translate('interface.setup.checkHeadroom', gid, uid),
		ok: channelRoom && categoryRoom,
		detail:
			channelRoom && categoryRoom
				? undefined
				: await translate('interface.setup.detailNoHeadroom', gid, uid, {
						current: String(currentChannels),
						needed: String(needed),
						limit: String(DISCORD_GUILD_CHANNEL_LIMIT)
					})
	});

	return { ok: checks.every((c) => c.ok), checks, server, botConfig, origin };
}

function renderChecks(checks: PreflightCheck[]) {
	return checks.map((c) => (c.ok ? `✅ ${c.label}` : `❌ ${c.label}${c.detail ? ` — ${c.detail}` : ''}`)).join('\n');
}

async function buildPreflightEmbed(interaction: any, guild: any, botName: string, defs: readonly ChannelDef[], preflight: PreflightResult) {
	const gid = guild.id;
	const uid = interaction.user.id;

	const embed = new EmbedBuilder()
		.setColor(preflight.ok ? COLOR_INFO : COLOR_ERR)
		.setTitle(await translate(preflight.ok ? 'interface.setup.preflightTitle' : 'interface.setup.blockedTitle', gid, uid))
		.setDescription(
			preflight.ok
				? await translate('interface.setup.preflightIntro', gid, uid, {
						count: String(defs.length),
						category: categoryNameFor(botName)
					})
				: await translate('interface.setup.blockedBody', gid, uid)
		)
		.addFields({
			name: await translate('interface.setup.preflightChecksField', gid, uid),
			value: renderChecks(preflight.checks).slice(0, 1024)
		});

	if (preflight.ok) {
		embed.addFields({
			name: await translate('interface.setup.preflightChannelsField', gid, uid),
			value: defs
				.map((d) => d.name)
				.join(' · ')
				.slice(0, 1024)
		});
	}

	return embed;
}

async function buildPreflightComponents(gid: string, uid: string) {
	return [
		new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId('setup_recommended')
				.setStyle(ButtonStyle.Success)
				.setLabel((await translate('interface.setup.btnRecommended', gid, uid)).slice(0, 80)),
			new ButtonBuilder()
				.setCustomId('setup_choose')
				.setStyle(ButtonStyle.Secondary)
				.setLabel((await translate('interface.setup.btnChoose', gid, uid)).slice(0, 80)),
			new ButtonBuilder()
				.setCustomId('setup_cancel')
				.setStyle(ButtonStyle.Secondary)
				.setLabel((await translate('interface.setup.btnCancel', gid, uid)).slice(0, 80))
		)
	];
}

async function buildModuleChooserPayload(interaction: any, selected: string[]) {
	const gid = interaction.guild.id;
	const uid = interaction.user.id;
	const chosen = normalizeModules(selected);
	const defs = setupChannelDefsForModules(chosen);

	const embed = new EmbedBuilder()
		.setColor(COLOR_INFO)
		.setTitle(await translate('interface.setup.chooseTitle', gid, uid))
		.setDescription(await translate('interface.setup.chooseBody', gid, uid))
		.addFields({
			name: await translate('interface.setup.chosenField', gid, uid, { count: String(defs.length) }),
			value:
				chosen
					.map((id) => `${moduleLabel(id)} → ${channelNamesForModule(id)}`)
					.join('\n')
					.slice(0, 1024) || (await translate('interface.setup.chosenNone', gid, uid))
		});

	const options = SETUP_MODULES.filter((m) => !m.required).map((m) =>
		new StringSelectMenuOptionBuilder()
			.setLabel(m.label)
			.setValue(m.id)
			.setEmoji(m.emoji)
			.setDescription(channelNamesForModule(m.id).slice(0, 100))
			.setDefault(chosen.includes(m.id))
	);

	const select = new StringSelectMenuBuilder()
		.setCustomId('setup_modules_select')
		.setPlaceholder((await translate('interface.setup.selectPlaceholder', gid, uid)).slice(0, 150))
		.setMinValues(0)
		.setMaxValues(options.length)
		.addOptions(options);

	return {
		embeds: [embed],
		components: [
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId('setup_create')
					.setStyle(ButtonStyle.Success)
					.setLabel((await translate('interface.setup.btnCreate', gid, uid)).slice(0, 80)),
				new ButtonBuilder()
					.setCustomId('setup_cancel')
					.setStyle(ButtonStyle.Secondary)
					.setLabel((await translate('interface.setup.btnCancel', gid, uid)).slice(0, 80))
			)
		]
	};
}

async function hasOwnerAccount(serverId: number) {
	const accounts = await db.getServerAccountsByServer(serverId);
	return accounts.some((a: { account_type: string }) => a.account_type === 'owner');
}

function findActiveOwnerInvite(invites: { account_type: string; used_by: unknown; used_at: unknown; expires_at: unknown; token: string }[]) {
	for (const inv of invites) {
		if (inv.account_type !== 'owner') continue;
		if (inv.used_by || inv.used_at) continue;
		if (inv.expires_at && isUtcSqlExpired(inv.expires_at as string | Date)) continue;
		return inv;
	}
	return null;
}

async function issueOwnerInvite(serverId: number, origin: string) {
	const invites = await db.getServerAccountInvitesByServer(serverId);
	const active = findActiveOwnerInvite(invites);
	if (active) return { url: `${origin}/register?token=${active.token}`, reused: true };

	const token = randomBytes(32).toString('hex');
	await db.createServerAccountInvite({
		token,
		server_id: serverId,
		account_type: 'owner',
		ttl_minutes: SETUP_OWNER_INVITE_TTL_MINUTES
	});
	return { url: `${origin}/register?token=${token}`, reused: false };
}

async function buildLinkPayload(interaction: any, server: any, origin: string) {
	const gid = interaction.guild.id;
	const uid = interaction.user.id;

	if (await hasOwnerAccount(server.id)) {
		const loginUrl = `${origin}/login`;
		return {
			embed: new EmbedBuilder()
				.setColor(COLOR_OK)
				.setTitle(await translate('interface.setup.linkTitle', gid, uid))
				.setDescription(
					`${await translate('interface.setup.linkOwnerClaimedBody', gid, uid)}\n\n${await translate('interface.panel.setupSignInLinkLine', gid, uid, { url: loginUrl })}`
				),
			row: new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setURL(loginUrl)
					.setLabel((await translate('interface.panel.setupOpenPanelButton', gid, uid)).slice(0, 80))
			)
		};
	}

	const { url } = await issueOwnerInvite(server.id, origin);
	const hours = Math.round(SETUP_OWNER_INVITE_TTL_MINUTES / 60);

	return {
		embed: new EmbedBuilder()
			.setColor(COLOR_OK)
			.setTitle(await translate('interface.panel.setupOwnerInviteEmbedTitle', gid, uid))
			.setDescription(
				`${await translate('interface.setup.linkInviteBody', gid, uid, { url })}\n\n${await translate('interface.setup.linkExpiresLine', gid, uid, { hours: String(hours) })}`
			),
		row: new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Link)
				.setURL(url)
				.setLabel((await translate('interface.panel.setupOwnerInviteButton', gid, uid)).slice(0, 80))
		)
	};
}

async function tryDmLink(interaction: any, embed: EmbedBuilder, row: ActionRowBuilder<ButtonBuilder>) {
	try {
		await interaction.user.send({ embeds: [embed], components: [row] });
		return true;
	} catch {
		return false;
	}
}

async function postInterface(guild: any, menuChannelId: string | undefined, interaction: any, client: any) {
	if (!menuChannelId) return false;
	try {
		const channel = guild.channels.cache.get(menuChannelId) ?? (await guild.channels.fetch(menuChannelId).catch(() => null));
		if (!channel) return false;
		const { createInterfaceEmbed, createInterfaceButtons } = await import('./interface.js');
		const embed = await createInterfaceEmbed(client, guild.id, interaction.user.id);
		const buttons = await createInterfaceButtons(guild.id, interaction.user.id);
		await channel.send({ embeds: [embed], components: Array.isArray(buttons) ? buttons : [buttons] });
		await logger.log(`🎮 Setup posted the bot interface to ${channel.name} in ${guild.name}`);
		return true;
	} catch (error: any) {
		await logger.log(`⚠️ Setup could not post the bot interface: ${error.message}`);
		return false;
	}
}

async function postSummary(interaction: any, guild: any, channelMap: Record<string, string>, moduleIds: string[], ownerClaimed: boolean) {
	const updatesId = channelMap.bot_updates;
	if (!updatesId) return;
	const channel = guild.channels.cache.get(updatesId) ?? (await guild.channels.fetch(updatesId).catch(() => null));
	if (!channel) return;

	const gid = guild.id;
	const uid = interaction.user.id;
	const modules = normalizeModules(moduleIds);

	const lines = modules
		.map((moduleId) => {
			const channels = SETUP_CHANNEL_DEFS.filter((d) => d.moduleId === moduleId)
				.map((d) => (channelMap[d.settingsKey] ? `<#${channelMap[d.settingsKey]}>` : `~~${d.name}~~`))
				.join(' ');
			return `${moduleLabel(moduleId)} → ${channels}`;
		})
		.join('\n');

	const embed = new EmbedBuilder()
		.setColor(COLOR_OK)
		.setTitle(await translate('interface.setup.summaryTitle', gid, uid))
		.setDescription(await translate('interface.setup.summaryIntro', gid, uid))
		.addFields(
			{ name: await translate('interface.setup.summaryChannelsField', gid, uid), value: lines.slice(0, 1024) },
			{
				name: await translate('interface.setup.summaryNextStepsField', gid, uid),
				value: (await translate(ownerClaimed ? 'interface.setup.summaryNextStepsClaimed' : 'interface.setup.summaryNextSteps', gid, uid)).slice(0, 1024)
			}
		)
		.setFooter({ text: (await translate('interface.setup.summaryFooter', gid, uid)).slice(0, 2048) });

	await channel.send({ embeds: [embed] }).catch(async (error: any) => {
		await logger.log(`⚠️ Setup summary could not be posted: ${error.message}`);
	});
}

async function showBuilding(interaction: any, gid: string, uid: string, done: number, total: number) {
	const embed = new EmbedBuilder()
		.setColor(COLOR_INFO)
		.setTitle(await translate('interface.setup.buildingTitle', gid, uid))
		.setDescription(await translate('interface.setup.buildingProgress', gid, uid, { done: String(done), total: String(total) }));
	await interaction.editReply({ embeds: [embed], components: [] }).catch(() => null);
}

function makeProgressReporter(interaction: any, gid: string, uid: string) {
	let lastReported = 0;
	return async (done: number, total: number) => {
		if (done !== total && done - lastReported < PROGRESS_EVERY) return;
		lastReported = done;
		await showBuilding(interaction, gid, uid, done, total);
	};
}

async function replyAlreadyRunning(interaction: any, gid: string, uid: string) {
	await interaction
		.editReply({
			embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.setup.alreadyRunning', gid, uid))],
			components: []
		})
		.catch(() => null);
}

async function createChannelsWithRollback(
	guild: any,
	defs: readonly ChannelDef[],
	categoryId: string,
	onProgress: (done: number, total: number) => Promise<void>
) {
	const created: any[] = [];
	const channelMap: Record<string, string> = {};
	try {
		let done = 0;
		for (const def of defs) {
			const channel = await guild.channels.create({
				name: def.name,
				type: ChannelType.GuildText,
				parent: categoryId
			});
			created.push(channel);
			channelMap[def.settingsKey] = channel.id;
			done += 1;
			await onProgress(done, defs.length);
		}
		return { channelMap, created };
	} catch (error) {
		for (const channel of created.reverse()) await channel.delete().catch(() => null);
		throw error;
	}
}

async function finishWithLink(interaction: any, guild: any, server: any, origin: string, title: string, bodyLines: (string | undefined)[]) {
	const gid = guild.id;
	const uid = interaction.user.id;
	const { embed, row } = await buildLinkPayload(interaction, server, origin);
	const dmOk = await tryDmLink(interaction, embed, row);

	const header = new EmbedBuilder()
		.setColor(COLOR_OK)
		.setTitle(title.slice(0, 256))
		.setDescription(
			[...bodyLines, await translate(dmOk ? 'interface.setup.linkDmSent' : 'interface.setup.linkDmFailed', gid, uid)]
				.filter(Boolean)
				.join('\n\n')
				.slice(0, 4096)
		);

	await interaction.editReply({ embeds: [header, embed], components: [row] });
}

async function performSetup(interaction: any, client: any, moduleIds: string[]) {
	const guild = interaction.guild;
	const gid = guild.id;
	const uid = interaction.user.id;
	const modules = normalizeModules(moduleIds);
	const defs = setupChannelDefsForModules(modules);

	if (inFlightGuilds.has(gid)) {
		await replyAlreadyRunning(interaction, gid, uid);
		return;
	}
	inFlightGuilds.add(gid);

	await showBuilding(interaction, gid, uid, 0, defs.length);
	const botName = await resolveBotName(gid);

	const preflight = await runPreflight(interaction, guild, defs.length);
	if (!preflight.ok || !preflight.server || !preflight.origin) {
		inFlightGuilds.delete(gid);
		const embed = await buildPreflightEmbed(interaction, guild, botName, defs, { ...preflight, ok: false });
		await interaction.editReply({ embeds: [embed], components: [] });
		return;
	}

	const server = preflight.server;
	const origin = preflight.origin;
	const progress = makeProgressReporter(interaction, gid, uid);

	syncComponent.suspendGuildSync(gid);
	try {
		const category = await guild.channels.create({
			name: categoryNameFor(botName),
			type: ChannelType.GuildCategory,
			permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
		});

		let channelMap: Record<string, string>;
		try {
			const result = await createChannelsWithRollback(guild, defs, category.id, progress);
			channelMap = result.channelMap;
		} catch (error) {
			await category.delete().catch(() => null);
			throw error;
		}

		await applyModuleSettings(server.id, modules, channelMap);
		await saveSetupRecord(server.id, {
			version: SETUP_RECORD_VERSION,
			category_id: category.id,
			channels: channelMap,
			modules,
			completed_at: new Date().toISOString()
		});

		await postInterface(guild, channelMap.menu, interaction, client);
		const ownerClaimed = await hasOwnerAccount(server.id);
		await postSummary(interaction, guild, channelMap, modules, ownerClaimed);

		clearSelection(gid, uid);
		await logger.log(`✅ Setup completed for ${guild.name} (${gid}) — ${defs.length} channels, modules: ${modules.join(', ')}`);

		await finishWithLink(interaction, guild, server, origin, await translate('interface.setup.doneTitle', gid, uid), [
			await translate('interface.setup.doneChannels', gid, uid, {
				count: String(defs.length),
				category: categoryNameFor(botName),
				menu: channelMap.menu ? `<#${channelMap.menu}>` : categoryNameFor(botName)
			}),
			await translate('interface.setup.doneBody', gid, uid)
		]);
	} finally {
		inFlightGuilds.delete(gid);
		syncComponent.resumeGuildSync(gid);
		await syncComponent.syncGuildData(guild).catch(() => null);
	}
}

async function performRepair(interaction: any, client: any, inspection: SetupInspection) {
	const guild = interaction.guild;
	const gid = guild.id;
	const uid = interaction.user.id;
	const modules = inspection.modules.length ? normalizeModules(inspection.modules) : recommendedSetupModuleIds();
	const defs = setupChannelDefsForModules(modules);

	if (inFlightGuilds.has(gid)) {
		await replyAlreadyRunning(interaction, gid, uid);
		return;
	}
	inFlightGuilds.add(gid);

	await showBuilding(interaction, gid, uid, 0, inspection.missing.length);
	const botName = await resolveBotName(gid);

	const preflight = await runPreflight(interaction, guild, inspection.missing.length);
	if (!preflight.ok || !preflight.server || !preflight.origin) {
		inFlightGuilds.delete(gid);
		const embed = await buildPreflightEmbed(interaction, guild, botName, defs, { ...preflight, ok: false });
		await interaction.editReply({ embeds: [embed], components: [] });
		return;
	}

	const server = preflight.server;
	const origin = preflight.origin;
	const progress = makeProgressReporter(interaction, gid, uid);

	syncComponent.suspendGuildSync(gid);
	try {
		let category = inspection.category;
		let reparented = 0;
		let categoryCreated = false;

		if (!category) {
			categoryCreated = true;
			category = await guild.channels.create({
				name: categoryNameFor(botName),
				type: ChannelType.GuildCategory,
				permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.SendMessages] }]
			});
			for (const status of inspection.statuses) {
				if (!status.exists || !status.channel) continue;
				if (status.channel.parentId === category.id) continue;
				const moved = await status.channel.setParent(category.id, { lockPermissions: true }).catch(() => null);
				if (moved) reparented += 1;
			}
		}

		const channelMap: Record<string, string> = {};
		for (const status of inspection.statuses) {
			if (status.exists && status.id) channelMap[status.def.settingsKey] = status.id;
		}

		const missingDefs = inspection.missing.map((s) => s.def);
		if (missingDefs.length) {
			try {
				const result = await createChannelsWithRollback(guild, missingDefs, category.id, progress);
				Object.assign(channelMap, result.channelMap);
			} catch (error) {
				if (categoryCreated && reparented === 0) await category.delete().catch(() => null);
				throw error;
			}
		}

		await applyModuleSettings(server.id, modules, channelMap);
		await saveSetupRecord(server.id, {
			version: SETUP_RECORD_VERSION,
			category_id: category.id,
			channels: channelMap,
			modules,
			completed_at: inspection.record?.completed_at || new Date().toISOString()
		});

		const menuWasMissing = inspection.missing.some((s) => s.def.settingsKey === 'menu');
		if (menuWasMissing) await postInterface(guild, channelMap.menu, interaction, client);

		const ownerClaimed = await hasOwnerAccount(server.id);
		await postSummary(interaction, guild, channelMap, modules, ownerClaimed);

		await logger.log(`🛠️ Setup repaired for ${guild.name} (${gid}) — created ${missingDefs.length}, reparented ${reparented}, adopted=${inspection.adopted}`);

		await finishWithLink(interaction, guild, server, origin, await translate('interface.setup.repairDoneTitle', gid, uid), [
			await translate('interface.setup.repairDoneBody', gid, uid, {
				created: String(missingDefs.length),
				list: missingDefs.map((d) => d.name).join(' · ') || '—'
			}),
			reparented ? await translate('interface.setup.repairReparented', gid, uid, { count: String(reparented) }) : undefined
		]);
	} finally {
		inFlightGuilds.delete(gid);
		syncComponent.resumeGuildSync(gid);
		await syncComponent.syncGuildData(guild).catch(() => null);
	}
}

async function buildStatusPayload(interaction: any, inspection: SetupInspection, serverId: number) {
	const guild = interaction.guild;
	const gid = guild.id;
	const uid = interaction.user.id;
	const okCount = inspection.statuses.filter((s) => s.exists).length;
	const total = inspection.statuses.length;
	const ownerClaimed = await hasOwnerAccount(serverId);

	const embed = new EmbedBuilder()
		.setColor(inspection.state === 'healthy' ? COLOR_OK : COLOR_WARN)
		.setTitle(await translate('interface.setup.statusTitle', gid, uid))
		.setDescription(await translate(inspection.state === 'healthy' ? 'interface.setup.statusHealthy' : 'interface.setup.statusPartial', gid, uid))
		.addFields(
			{
				name: await translate('interface.setup.statusCategoryField', gid, uid),
				value: inspection.category ? `✅ ${inspection.category.name}` : `⚠️ ${await translate('interface.setup.statusCategoryMissing', gid, uid)}`
			},
			{
				name: await translate('interface.setup.statusChannelsField', gid, uid),
				value: (await translate('interface.setup.statusChannelsLine', gid, uid, { ok: String(okCount), total: String(total) })).slice(0, 1024)
			},
			{
				name: await translate('interface.setup.statusModulesField', gid, uid),
				value: inspection.modules
					.map((id) => {
						const channels = SETUP_CHANNEL_DEFS.filter((d) => d.moduleId === id);
						const rendered = channels
							.map((d) => {
								const status = inspection.statuses.find((s) => s.def.settingsKey === d.settingsKey);
								return status?.exists ? `<#${status.id}>` : `⚠️ ${d.name}`;
							})
							.join(' ');
						return `${moduleLabel(id)} → ${rendered}`;
					})
					.join('\n')
					.slice(0, 1024)
			},
			{
				name: await translate('interface.setup.statusOwnerField', gid, uid),
				value: await translate(ownerClaimed ? 'interface.setup.statusOwnerClaimed' : 'interface.setup.statusOwnerUnclaimed', gid, uid)
			}
		);

	if (inspection.adopted) {
		embed.setFooter({ text: (await translate('interface.setup.statusAdopted', gid, uid)).slice(0, 2048) });
	}

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId('setup_link')
			.setStyle(ButtonStyle.Primary)
			.setLabel((await translate('interface.setup.btnGetLink', gid, uid)).slice(0, 80)),
		new ButtonBuilder()
			.setCustomId('setup_repair')
			.setStyle(inspection.state === 'healthy' ? ButtonStyle.Secondary : ButtonStyle.Success)
			.setLabel((await translate('interface.setup.btnRepair', gid, uid)).slice(0, 80)),
		new ButtonBuilder()
			.setCustomId('setup_recreate')
			.setStyle(ButtonStyle.Danger)
			.setLabel((await translate('interface.setup.btnRecreate', gid, uid)).slice(0, 80))
	);

	return { embeds: [embed], components: [row] };
}

async function resolveServerForSetup(guild: any) {
	const botConfig = getBotConfig();
	if (!botConfig) return null;
	let server = await db.getServerByDiscordId(botConfig.id, guild.id).catch(() => null);
	if (!server) server = await db.upsertOfficialServer(botConfig.id, guild).catch(() => null);
	return server;
}

export async function runSetupCommand(interaction: any, client: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!interaction.guild) return;
		if (!isSetupActor(interaction)) {
			await denySetupActor(interaction);
			return;
		}

		await interaction.deferReply({ flags: EPHEMERAL });

		const guild = interaction.guild;
		const botName = await resolveBotName(gid);
		const server = await resolveServerForSetup(guild);

		if (server) {
			const inspection = await inspectSetup(guild, server.id);
			if (inspection.state !== 'fresh') {
				const payload = await buildStatusPayload(interaction, inspection, server.id);
				await interaction.editReply(payload);
				return;
			}
		}

		const modules = recommendedSetupModuleIds();
		const defs = setupChannelDefsForModules(modules);
		const preflight = await runPreflight(interaction, guild, defs.length);
		const embed = await buildPreflightEmbed(interaction, guild, botName, defs, preflight);

		await interaction.editReply({
			embeds: [embed],
			components: preflight.ok ? await buildPreflightComponents(gid, uid) : []
		});
	} catch (error: any) {
		await logger.log(`❌ /setup failed in ${interaction.guild?.name} (${gid}): ${error.message}`);
		const errorMsg = await translate('interface.panel.error', gid, uid, { error: error.message });
		const embeds = [new EmbedBuilder().setColor(COLOR_ERR).setDescription(errorMsg.slice(0, 4096))];
		if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds, components: [] }).catch(() => null);
		else await interaction.reply({ embeds, flags: EPHEMERAL }).catch(() => null);
	}
}

export function isSetupInteractionId(customId: string) {
	return typeof customId === 'string' && customId.startsWith('setup_');
}

export async function handleSetupButton(interaction: any, client: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!interaction.guild) return;
		if (!isSetupActor(interaction)) {
			await denySetupActor(interaction);
			return;
		}

		const customId = interaction.customId;

		if (customId === 'setup_cancel') {
			clearSelection(gid, uid);
			await interaction.update({
				embeds: [
					new EmbedBuilder()
						.setColor(COLOR_WARN)
						.setTitle(await translate('interface.setup.cancelledTitle', gid, uid))
						.setDescription(await translate('interface.setup.cancelledBody', gid, uid))
				],
				components: []
			});
			return;
		}

		if (customId === 'setup_choose') {
			const existing = getSelection(gid, uid) ?? recommendedSetupModuleIds();
			setSelection(gid, uid, existing);
			await interaction.update(await buildModuleChooserPayload(interaction, existing));
			return;
		}

		if (customId === 'setup_recommended') {
			await interaction.deferUpdate();
			await performSetup(interaction, client, recommendedSetupModuleIds());
			return;
		}

		if (customId === 'setup_create') {
			const selected = getSelection(gid, uid);
			if (!selected) {
				await interaction.update({
					embeds: [new EmbedBuilder().setColor(COLOR_WARN).setDescription(await translate('interface.setup.selectionExpired', gid, uid))],
					components: []
				});
				return;
			}
			await interaction.deferUpdate();
			await performSetup(interaction, client, selected);
			return;
		}

		await interaction.deferUpdate();

		const server = await resolveServerForSetup(interaction.guild);
		if (!server) {
			await interaction.editReply({
				embeds: [new EmbedBuilder().setColor(COLOR_ERR).setDescription(await translate('interface.setup.detailNoServer', gid, uid))],
				components: []
			});
			return;
		}

		if (customId === 'setup_link') {
			const origin = publicSiteOrigin();
			if (!origin) {
				await interaction.editReply({
					embeds: [new EmbedBuilder().setColor(COLOR_ERR).setDescription(await translate('interface.setup.detailNoBaseUrl', gid, uid))],
					components: []
				});
				return;
			}
			await finishWithLink(interaction, interaction.guild, server, origin, await translate('interface.setup.linkTitle', gid, uid), [
				await translate('interface.setup.linkHeaderBody', gid, uid)
			]);
			return;
		}

		if (customId === 'setup_repair') {
			const inspection = await inspectSetup(interaction.guild, server.id);
			if (inspection.state === 'fresh') {
				await performSetup(interaction, client, recommendedSetupModuleIds());
				return;
			}
			if (inspection.state === 'healthy') {
				await interaction.editReply({
					embeds: [
						new EmbedBuilder()
							.setColor(COLOR_OK)
							.setTitle(await translate('interface.setup.repairNothingTitle', gid, uid))
							.setDescription(await translate('interface.setup.repairNothingBody', gid, uid))
					],
					components: []
				});
				return;
			}
			await performRepair(interaction, client, inspection);
			return;
		}

		if (customId === 'setup_recreate') {
			const inspection = await inspectSetup(interaction.guild, server.id);
			const botName = await resolveBotName(gid);
			await interaction.editReply({
				embeds: [
					new EmbedBuilder()
						.setColor(COLOR_WARN)
						.setTitle(await translate('interface.setup.recreateConfirmTitle', gid, uid))
						.setDescription(
							await translate('interface.setup.recreateConfirmBody', gid, uid, {
								category: categoryNameFor(botName),
								existing: inspection.category ? inspection.category.name : categoryNameFor(botName)
							})
						)
				],
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setCustomId('setup_recreate_confirm')
							.setStyle(ButtonStyle.Danger)
							.setLabel((await translate('interface.setup.btnRecreateConfirm', gid, uid)).slice(0, 80)),
						new ButtonBuilder()
							.setCustomId('setup_cancel')
							.setStyle(ButtonStyle.Secondary)
							.setLabel((await translate('interface.setup.btnCancel', gid, uid)).slice(0, 80))
					)
				]
			});
			return;
		}

		if (customId === 'setup_recreate_confirm') {
			const inspection = await inspectSetup(interaction.guild, server.id);
			const modules = inspection.modules.length ? inspection.modules : recommendedSetupModuleIds();
			await performSetup(interaction, client, modules);
			return;
		}

		await logger.log(`🔍 Unknown setup button: ${customId}`);
	} catch (error: any) {
		await logger.log(`❌ Setup button "${interaction.customId}" failed: ${error.message}`);
		const errorMsg = await translate('interface.panel.error', gid, uid, { error: error.message });
		const embeds = [new EmbedBuilder().setColor(COLOR_ERR).setDescription(errorMsg.slice(0, 4096))];
		if (interaction.deferred || interaction.replied) await interaction.editReply({ embeds, components: [] }).catch(() => null);
		else await interaction.reply({ embeds, flags: EPHEMERAL }).catch(() => null);
	}
}

export async function handleSetupSelect(interaction: any) {
	const gid = interaction.guild?.id ?? '';
	const uid = interaction.user?.id ?? '';

	try {
		if (!interaction.guild) return;
		if (!isSetupActor(interaction)) {
			await denySetupActor(interaction);
			return;
		}

		const selected = normalizeModules(interaction.values ?? []);
		setSelection(gid, uid, selected);
		await interaction.update(await buildModuleChooserPayload(interaction, selected));
	} catch (error: any) {
		await logger.log(`❌ Setup module select failed: ${error.message}`);
	}
}

export default { runSetupCommand, handleSetupButton, handleSetupSelect, isSetupInteractionId };
