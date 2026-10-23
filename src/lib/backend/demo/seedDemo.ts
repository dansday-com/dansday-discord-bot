import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from '../../drizzle.js';
import * as schema from '../../schema.js';
import { SERVER_SETTINGS, APP_NAME } from '../panelServer.js';
import { ITEM_EFFECTS } from '../../items.js';
import { initializeDatabase } from '../../database.js';
import { toMySQLDateTime } from '../../utils/datetime.js';

const DEMO = {
	serverCount: 2,
	membersPerServerMin: 50,
	membersPerServerMax: 100,
	publicSlugPrefix: 'demo',
	demoBot: {
		name: 'Demo Bot',
		token: 'DEMO_TOKEN_DO_NOT_USE',
		application_id: 'demo_app_0001',
		port: 0,
		secret_key: 'demo_secret_key'
	},
	demoSuperadmin: {
		username: 'demoadmin',
		email: 'demoadmin@dansday.local'
	}
} as const;

function slugifySimple(s: string) {
	return (
		String(s || '')
			.trim()
			.toLowerCase()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '') || 'demo'
	);
}

type EnsureDemoResult = {
	bot_id: number;
	superadmin_account_id: number;
	server_ids: number[];
	panel_id: number;
};

type SeedClock = { now: Date; nowDb: Date };
type SeedItem = { id: number; effect: string };
type ServerSeed = { sessionSlug: string; index: number; botId: number; items: SeedItem[]; clock: SeedClock };
type ServerContext = ServerSeed & { serverId: number; roleId: (key: string) => number | null };
type DemoMember = ReturnType<typeof demoMember>;

const FIRST_NAMES = [
	'Budi',
	'Siti',
	'Andi',
	'Dewi',
	'Rizky',
	'Nurul',
	'Fajar',
	'Intan',
	'Dimas',
	'Ayu',
	'Hafiz',
	'Nadia',
	'Reza',
	'Fitri',
	'Arif',
	'Danto',
	'Yusuf',
	'Lestari',
	'Bagas',
	'Amira'
];
const LAST_NAMES = ['Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Hidayat', 'Rahman', 'Abdullah', 'Ismail', 'Hasan', 'Aziz'];

const ROLE_DEFS = [
	{ key: 'owner', name: 'Owner', position: 8, color: '#e74c3c' },
	{ key: 'admin', name: 'Admin', position: 7, color: '#ff4d4d' },
	{ key: 'moderator', name: 'Moderator', position: 6, color: '#4d7cff' },
	{ key: 'staff', name: 'Staff', position: 5, color: '#95a5a6' },
	{ key: 'content_creator', name: 'Content Creator', position: 4, color: '#9b59b6' },
	{ key: 'supporter', name: 'Supporter', position: 3, color: '#f39c12' },
	{ key: 'member', name: 'Member', position: 2, color: '#2ecc71' },
	{ key: 'unverified', name: 'Unverified', position: 1, color: '#7b7b7b' }
];

const ROLE_CYCLE = ['owner', 'admin', 'moderator', 'staff', 'content_creator', 'supporter', 'member', 'member', 'member', 'unverified'];
const XP_SOURCES = ['chat', 'voice', 'video'];

function rngFor(serverIndex: number) {
	return (n: number) => (serverIndex * 9301 + n * 49297 + 233280) % 1_000_000;
}

async function ensureDemoAdmin(sessionSlug: string, { now, nowDb }: SeedClock) {
	const sessionUsername = `demo_${sessionSlug}`;
	const pwHash = await bcrypt.hash(`demo-${now.getUTCFullYear()}`, 10);
	await db
		.insert(schema.accounts)
		.values({
			username: sessionUsername,
			email: `demo_${sessionSlug}@dansday.local`,
			password_hash: pwHash,
			account_type: 'superadmin',
			ip_address: null,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	const demoAdmin = await db
		.select()
		.from(schema.accounts)
		.where(sql`${schema.accounts.username} = ${sessionUsername}`)
		.limit(1)
		.then((r) => r[0] ?? null);
	if (!demoAdmin?.id) {
		throw new Error('Failed to ensure demo superadmin');
	}
	return demoAdmin;
}

async function ensureDemoPanel(accountId: number, nowDb: Date) {
	await db
		.insert(schema.panel)
		.values({ account_id: accountId, created_at: nowDb, updated_at: nowDb })
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	const demoPanel = await db
		.select()
		.from(schema.panel)
		.where(sql`${schema.panel.account_id} = ${accountId}`)
		.limit(1)
		.then((r) => r[0] ?? null);
	if (!demoPanel?.id) {
		throw new Error('Failed to ensure demo panel');
	}
	return demoPanel;
}

async function ensureDemoBot(sessionSlug: string, panelId: number, nowDb: Date) {
	const applicationId = `demo_app_${sessionSlug}`;
	await db
		.insert(schema.bots)
		.values({
			name: DEMO.demoBot.name,
			token: DEMO.demoBot.token,
			application_id: applicationId,
			bot_icon: null,
			port: DEMO.demoBot.port,
			secret_key: DEMO.demoBot.secret_key,
			panel_id: panelId,
			status: 'stopped',
			process_id: null,
			uptime_started_at: null,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({
			set: {
				name: DEMO.demoBot.name,
				panel_id: panelId,
				updated_at: nowDb
			}
		});

	const botRow = await db
		.select()
		.from(schema.bots)
		.where(sql`${schema.bots.application_id} = ${applicationId}`)
		.limit(1)
		.then((r) => r[0] ?? null);
	if (!botRow?.id) {
		throw new Error('Failed to ensure demo bot');
	}
	return botRow;
}

async function seedDemoItems(panelId: number, nowDb: Date): Promise<SeedItem[]> {
	const seededItems: SeedItem[] = [];
	for (const [idx, effect] of ITEM_EFFECTS.entries()) {
		await db
			.insert(schema.items)
			.values({
				panel_id: panelId,
				name: effect.label,
				effect_type: effect.id,
				description: effect.summary(effect.defaultConfig),
				cost: effect.defaultCost,
				config: effect.defaultConfig,
				enabled: true,
				sort_order: idx,
				created_at: nowDb,
				updated_at: nowDb
			})
			.onDuplicateKeyUpdate({ set: { name: effect.label, config: effect.defaultConfig, cost: effect.defaultCost, updated_at: nowDb } });
		const itemRow = await db
			.select({ id: schema.items.id })
			.from(schema.items)
			.where(sql`${schema.items.panel_id} = ${panelId} AND ${schema.items.effect_type} = ${effect.id}`)
			.limit(1)
			.then((r) => r[0] ?? null);
		if (itemRow?.id) {
			seededItems.push({ id: itemRow.id, effect: effect.id });
		}
	}
	return seededItems;
}

async function ensureDemoServer({ sessionSlug, index, botId, clock }: ServerSeed) {
	const discordServerId = `${sessionSlug}_server_${String(index).padStart(4, '0')}`;
	const serverName = `${APP_NAME} Demo Server ${index}`;

	await db.execute(sql`
		INSERT INTO servers
			(bot_id, discord_server_id, name, total_members, total_channels, total_boosters, boost_level, server_icon, discord_created_at, vanity_url_code, invite_code, created_at, updated_at)
		VALUES
			(${botId}, ${discordServerId}, ${serverName}, 0, 0, 0, 0, NULL, NULL, NULL, NULL, ${clock.nowDb}, ${clock.nowDb})
		ON DUPLICATE KEY UPDATE
			bot_id = VALUES(bot_id),
			name = VALUES(name),
			updated_at = VALUES(updated_at)
	`);

	const serverRow = await db
		.select()
		.from(schema.servers)
		.where(sql`${schema.servers.discord_server_id} = ${discordServerId}`)
		.limit(1)
		.then((r) => r[0] ?? null);
	if (!serverRow?.id) {
		throw new Error(`Failed to ensure demo server ${index}`);
	}
	return serverRow;
}

async function seedPublicSettings(serverId: number, slug: string, nowDb: Date) {
	await db
		.insert(schema.serverSettings)
		.values({
			server_id: serverId,
			component_name: SERVER_SETTINGS.component.public,
			settings: { slug, items_enabled: true, minigames_enabled: true, market_enabled: true, tasks_enabled: true, invite_enabled: true },
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({
			set: {
				settings: sql`JSON_SET(COALESCE(${schema.serverSettings.settings}, JSON_OBJECT()), '$.slug', ${slug}, '$.items_enabled', true, '$.minigames_enabled', true, '$.market_enabled', true, '$.tasks_enabled', true, '$.invite_enabled', true)`,
				updated_at: nowDb
			}
		});
}

async function seedServerCategories(serverId: number, pfx: string, nowDb: Date) {
	await db
		.insert(schema.serverCategories)
		.values([
			{ server_id: serverId, discord_category_id: `${pfx}_cat_info`, name: 'Information', position: 3, created_at: nowDb, updated_at: nowDb },
			{ server_id: serverId, discord_category_id: `${pfx}_cat_chat`, name: 'Community', position: 2, created_at: nowDb, updated_at: nowDb },
			{ server_id: serverId, discord_category_id: `${pfx}_cat_voice`, name: 'Voice', position: 1, created_at: nowDb, updated_at: nowDb }
		])
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	const categories = await db
		.select()
		.from(schema.serverCategories)
		.where(sql`${schema.serverCategories.server_id} = ${serverId}`);
	return (discordId: string) => categories.find((c) => c.discord_category_id === discordId)?.id ?? null;
}

async function seedServerRoles(serverId: number, pfx: string, nowDb: Date) {
	await db
		.insert(schema.serverRoles)
		.values(
			ROLE_DEFS.map((r) => ({
				server_id: serverId,
				discord_role_id: `${pfx}_role_${r.key}`,
				name: r.name,
				position: r.position,
				color: r.color,
				permissions: '0',
				created_at: nowDb,
				updated_at: nowDb
			}))
		)
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	const seededRoles = await db
		.select()
		.from(schema.serverRoles)
		.where(sql`${schema.serverRoles.server_id} = ${serverId}`);
	return (key: string) => seededRoles.find((r) => r.discord_role_id === `${pfx}_role_${key}`)?.id ?? null;
}

async function seedServerChannels(serverId: number, pfx: string, nowDb: Date) {
	const catId = await seedServerCategories(serverId, pfx, nowDb);
	const channel = (key: string, spec: { name: string; type: string; category: string; position: number }) => ({
		server_id: serverId,
		discord_channel_id: `${pfx}_${key}`,
		name: spec.name,
		type: spec.type,
		category_id: catId(`${pfx}_cat_${spec.category}`),
		position: spec.position,
		created_at: nowDb,
		updated_at: nowDb
	});
	await db
		.insert(schema.serverChannels)
		.values([
			channel('ch_rules', { name: 'rules', type: 'guild_text', category: 'info', position: 3 }),
			channel('ch_ann', { name: 'announcements', type: 'guild_announcement', category: 'info', position: 2 }),
			channel('ch_general', { name: 'general', type: 'guild_text', category: 'chat', position: 1 }),
			channel('vc_lounge', { name: 'Lounge', type: 'guild_voice', category: 'voice', position: 1 })
		])
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
}

async function upsertAccountServer(serverId: number, account: { username: string; accountType: 'owner' | 'staff' }, nowDb: Date) {
	const passwordHash = await bcrypt.hash('demo', 10);
	await db
		.insert(schema.accounts)
		.values({
			username: account.username,
			email: `${account.username}@dansday.local`,
			password_hash: passwordHash,
			account_type: 'user',
			ip_address: null,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
	const [row] = await db
		.select({ id: schema.accounts.id })
		.from(schema.accounts)
		.where(sql`${schema.accounts.username} = ${account.username}`)
		.limit(1);
	if (!row) {
		return;
	}
	await db
		.insert(schema.accountServers)
		.values({ account_id: row.id, server_id: serverId, account_type: account.accountType, is_frozen: false, created_at: nowDb, updated_at: nowDb })
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
}

async function seedAccountServers(serverId: number, { sessionSlug, index, clock }: ServerSeed) {
	await upsertAccountServer(serverId, { username: `${sessionSlug}_owner_${index}`, accountType: 'owner' }, clock.nowDb);
	const moderatorCount = 1 + (rngFor(index)(serverId + 77) % 10);
	for (let m = 1; m <= moderatorCount; m++) {
		await upsertAccountServer(serverId, { username: `${sessionSlug}_mod_${index}_${m}`, accountType: 'staff' }, clock.nowDb);
	}
}

function demoMemberLevel(i: number, isZeroMember: boolean, nowDb: Date) {
	const exp = isZeroMember ? 0 : Math.max(0, Math.round(120_000 / (1 + i * 0.07)) + (i % 9) * 133 - i * 31);
	return {
		chat_total: isZeroMember ? 0 : Math.max(0, 22_000 - i * 83 + (i % 7) * 41),
		voice_minutes_total: isZeroMember ? 0 : Math.max(0, 48_000 - i * 177 + (i % 11) * 97),
		voice_minutes_active: isZeroMember ? 0 : Math.max(0, 36_000 - i * 141 + (i % 10) * 71),
		voice_minutes_afk: isZeroMember ? 0 : Math.max(0, 12_000 - i * 41 + (i % 8) * 23),
		voice_minutes_video: isZeroMember ? 0 : Math.max(0, 3_200 - i * 9 + (i % 6) * 7),
		voice_minutes_streaming: isZeroMember ? 0 : Math.max(0, 1_100 - i * 4 + (i % 9) * 5),
		xp: exp,
		level: isZeroMember ? 0 : Math.max(1, Math.round(exp / 650)),
		is_in_voice: false,
		is_in_video: false,
		is_in_stream: false,
		rank: null,
		chat_rewarded_at: null,
		voice_rewarded_at: null,
		video_rewarded_at: null,
		stream_rewarded_at: null,
		created_at: nowDb,
		updated_at: nowDb
	};
}

function demoMember(i: number, { sessionSlug, index, clock }: ServerSeed) {
	const { nowDb } = clock;
	const base = clock.now.getTime();
	const n = i + 1;
	const baseName = `${FIRST_NAMES[i % FIRST_NAMES.length]}${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}${index}${n}`;
	const hasAfkPrefix = (n >= 1 && n <= 5) || n % 17 === 0 || n === 7;
	const username = hasAfkPrefix ? `[AFK] ${baseName}` : baseName;
	const nickname = `${FIRST_NAMES[(i + 3) % FIRST_NAMES.length]}-${n}`;
	const isBooster = n % 9 === 0;
	return {
		discord_member_id: `${sessionSlug}${index}_user_${String(n).padStart(4, '0')}`,
		username,
		display_name: `Demo ${username}`,
		server_display_name: n % 5 === 0 ? `[AFK] ${nickname}` : nickname,
		avatar: null,
		profile_created_at: toMySQLDateTime(new Date(base - n * 86400000)),
		member_since: toMySQLDateTime(new Date(base - n * 43200000)),
		is_booster: isBooster,
		booster_since: isBooster ? toMySQLDateTime(new Date(base - n * 22200000)) : null,
		language: null,
		level: demoMemberLevel(i, n <= 10, nowDb),
		afk: n % 13 === 0 ? { message: 'Stepped out for a bit' } : null
	};
}

async function upsertDemoMember(serverId: number, m: DemoMember, nowDb: Date): Promise<number | null> {
	await db
		.insert(schema.serverMembers)
		.values({
			server_id: serverId,
			discord_member_id: m.discord_member_id,
			username: m.username,
			display_name: m.display_name,
			server_display_name: m.server_display_name,
			avatar: m.avatar,
			profile_created_at: m.profile_created_at,
			member_since: m.member_since,
			is_booster: m.is_booster,
			booster_since: m.booster_since,
			language: m.language,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({
			set: {
				username: m.username,
				display_name: m.display_name,
				server_display_name: m.server_display_name,
				is_booster: m.is_booster ?? false,
				updated_at: nowDb
			}
		});

	const memberRow = await db
		.select({ id: schema.serverMembers.id })
		.from(schema.serverMembers)
		.where(sql`${schema.serverMembers.server_id} = ${serverId} AND ${schema.serverMembers.discord_member_id} = ${m.discord_member_id}`)
		.limit(1)
		.then((r) => r[0] ?? null);
	return memberRow?.id ? Number(memberRow.id) : null;
}

async function seedMemberLevel(memberId: number, m: DemoMember, nowDb: Date) {
	await db
		.insert(schema.serverMemberLevels)
		.values({ member_id: memberId, ...m.level })
		.onDuplicateKeyUpdate({
			set: {
				chat_total: m.level.chat_total,
				voice_minutes_total: m.level.voice_minutes_total,
				voice_minutes_active: m.level.voice_minutes_active,
				voice_minutes_afk: m.level.voice_minutes_afk,
				xp: m.level.xp,
				level: m.level.level,
				updated_at: nowDb
			}
		});

	if (m.afk) {
		await db
			.insert(schema.serverMemberAfks)
			.values({ member_id: memberId, message: m.afk.message, created_at: nowDb, updated_at: nowDb })
			.onDuplicateKeyUpdate({ set: { message: m.afk.message, updated_at: nowDb } });
	}
}

async function seedMemberBag(memberId: number, position: number, { items, clock }: ServerContext) {
	const bagSize = 1 + (position % 4);
	let bagTotal = 0;
	for (let b = 0; b < bagSize; b++) {
		const item = items[(position + b) % items.length];
		const qty = 1 + ((position + b) % 5);
		if (bagTotal + qty > 50) {
			break;
		}
		bagTotal += qty;
		const acquiredAt = toMySQLDateTime(new Date(clock.now.getTime() - (position + b) * 3_600_000));
		await db
			.insert(schema.serverMemberItems)
			.values({ member_id: memberId, item_id: item.id, quantity: qty, acquired_at: acquiredAt, created_at: clock.nowDb, updated_at: clock.nowDb })
			.onDuplicateKeyUpdate({ set: { quantity: qty, updated_at: clock.nowDb } });

		await db.insert(schema.serverMemberItemLogs).values({
			member_id: memberId,
			member_item_id: null,
			target_member_id: null,
			item_id: item.id,
			action: 'buy',
			xp: 100 * qty,
			outcome: 'success',
			created_at: acquiredAt
		});
	}
}

async function seedMemberXpLogs(memberId: number, position: number, { m, clock }: { m: DemoMember; clock: SeedClock }) {
	for (let h = 0; h < 4; h++) {
		const amount = 50 + ((position + h) % 6) * 25;
		await db.insert(schema.serverMemberLevelLogs).values({
			member_id: memberId,
			source: XP_SOURCES[(position + h) % XP_SOURCES.length],
			xp: amount,
			xp_total: Math.max(0, m.level.xp - (3 - h) * amount),
			level: m.level.level,
			rank: null,
			multiplier: null,
			skim_percent: null,
			created_at: toMySQLDateTime(new Date(clock.now.getTime() - h * 1_800_000))
		});
	}
}

async function seedDemoMember(ctx: ServerContext, m: DemoMember, position: number): Promise<number | null> {
	const { nowDb } = ctx.clock;
	const memberId = await upsertDemoMember(ctx.serverId, m, nowDb);
	if (memberId === null) {
		return null;
	}

	await seedMemberLevel(memberId, m, nowDb);
	await db.delete(schema.serverMemberItemLogs).where(sql`${schema.serverMemberItemLogs.member_id} = ${memberId}`);
	await db.delete(schema.serverMemberLevelLogs).where(sql`${schema.serverMemberLevelLogs.member_id} = ${memberId}`);

	if (ctx.items.length > 0 && position % 10 !== 3 && m.level.xp > 0) {
		await seedMemberBag(memberId, position, ctx);
	}
	if (m.level.xp > 0) {
		await seedMemberXpLogs(memberId, position, { m, clock: ctx.clock });
	}

	const assignedRoleId = ctx.roleId(ROLE_CYCLE[position % ROLE_CYCLE.length]);
	if (assignedRoleId) {
		await db
			.insert(schema.serverMemberRoles)
			.values({ member_id: memberId, role_id: assignedRoleId, created_at: nowDb })
			.onDuplicateKeyUpdate({ set: { role_id: assignedRoleId } });
	}
	return memberId;
}

async function seedMemberInvites(memberIds: number[], { now, nowDb }: SeedClock) {
	const inviterIds = memberIds.slice(0, 5);
	for (let i = inviterIds.length; i < memberIds.length; i++) {
		const kind = i % 9;
		const inviterId = inviterIds[i % inviterIds.length];
		const joinedAt = toMySQLDateTime(new Date(now.getTime() - i * 5_400_000));
		const isPaid = kind > 2;
		const row = {
			member_id: memberIds[i],
			inviter_member_id: inviterId,
			code: i % 2 === 0 ? `demo${inviterId}` : `demoDiscord${inviterId}`,
			source: i % 2 === 0 ? 'personal' : 'invite',
			fake_reason: kind === 1 ? 'account_age' : null,
			xp: isPaid ? 1000 : 0,
			rewarded_at: isPaid ? joinedAt : null,
			joined_at: joinedAt,
			left_at: kind === 0 ? nowDb : null,
			created_at: joinedAt
		};
		await db
			.insert(schema.serverMemberInvites)
			.values(row)
			.onDuplicateKeyUpdate({ set: { inviter_member_id: row.inviter_member_id, fake_reason: row.fake_reason, xp: row.xp, left_at: row.left_at } });
	}
}

async function refreshServerTotals(serverId: number, nowDb: Date) {
	await db.execute(sql`
		UPDATE servers
		SET
			total_members = (SELECT COUNT(*) FROM server_members WHERE server_id = ${serverId}),
			total_channels = (SELECT COUNT(*) FROM server_channels WHERE server_id = ${serverId}),
			total_boosters = (SELECT COUNT(*) FROM server_members WHERE server_id = ${serverId} AND is_booster = 1),
			updated_at = ${nowDb}
		WHERE id = ${serverId}
	`);
}

async function seedDemoServer(seed: ServerSeed): Promise<number> {
	const { nowDb } = seed.clock;
	const serverRow = await ensureDemoServer(seed);
	const serverId = serverRow.id;
	const pfx = `${seed.sessionSlug}${seed.index}`;

	await seedPublicSettings(serverId, slugifySimple(`${seed.sessionSlug}-${seed.index}`), nowDb);
	const roleId = await seedServerRoles(serverId, pfx, nowDb);
	await seedServerChannels(serverId, pfx, nowDb);
	await seedAccountServers(serverId, seed);

	const ctx: ServerContext = { ...seed, serverId, roleId };
	const memberCount = DEMO.membersPerServerMin + (rngFor(seed.index)(serverId) % (DEMO.membersPerServerMax - DEMO.membersPerServerMin + 1));
	const memberIds: number[] = [];
	for (let i = 0; i < memberCount; i++) {
		const memberId = await seedDemoMember(ctx, demoMember(i, seed), i);
		if (memberId !== null) {
			memberIds.push(memberId);
		}
	}

	await seedMemberInvites(memberIds, seed.clock);
	await refreshServerTotals(serverId, nowDb);
	return serverId;
}

async function seedPanelExtras(panelId: number, nowDb: Date) {
	const selfbotCount = 1 + (rngFor(1)(panelId) % 5);
	await db
		.insert(schema.selfbots)
		.values(
			Array.from({ length: selfbotCount }).map((_, i) => ({
				panel_id: panelId,
				name: `Demo Selfbot #${i + 1}`,
				token: 'DEMO_TOKEN_DO_NOT_USE',
				bot_icon: null,
				status: 'stopped' as const,
				process_id: null,
				uptime_started_at: null,
				created_at: nowDb,
				updated_at: nowDb
			}))
		)
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	await db
		.insert(schema.panelSettings)
		.values({
			panel_id: panelId,
			component_name: SERVER_SETTINGS.component.discord_quest_notifier,
			settings: { auto_quest: false },
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
}

export async function seedDemoSession(sessionSlug: string): Promise<EnsureDemoResult> {
	await initializeDatabase();

	const now = new Date();
	const clock: SeedClock = { now, nowDb: toMySQLDateTime(now) };

	const demoAdmin = await ensureDemoAdmin(sessionSlug, clock);
	const demoPanel = await ensureDemoPanel(demoAdmin.id, clock.nowDb);
	const botRow = await ensureDemoBot(sessionSlug, demoPanel.id, clock.nowDb);
	const items = await seedDemoItems(demoPanel.id, clock.nowDb);

	const serverIds: number[] = [];
	for (let index = 1; index <= DEMO.serverCount; index++) {
		serverIds.push(await seedDemoServer({ sessionSlug, index, botId: botRow.id, items, clock }));
	}

	await seedPanelExtras(demoPanel.id, clock.nowDb);

	return { bot_id: botRow.id, superadmin_account_id: demoAdmin.id, server_ids: serverIds, panel_id: demoPanel.id };
}

export async function cleanupDemoSession(sessionSlug: string): Promise<void> {
	await initializeDatabase();
	const sessionUsername = `demo_${sessionSlug}`;
	const memberPrefix = `${sessionSlug}_`;
	await db.delete(schema.accounts).where(sql`${schema.accounts.username} = ${sessionUsername}`);
	await db
		.delete(schema.accounts)
		.where(sql`${schema.accounts.account_type} = 'user' AND LEFT(${schema.accounts.username}, ${memberPrefix.length}) = ${memberPrefix}`);
}
