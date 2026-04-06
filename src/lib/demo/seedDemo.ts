import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { db } from '../drizzle.js';
import * as schema from '../schema.js';
import { SERVER_SETTINGS } from '../serverSettingsComponents.js';
import { initializeDatabase } from '../database.js';
import { toMySQLDateTime } from '../utils/datetime.js';

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
};

export async function ensureDemoReady(): Promise<EnsureDemoResult> {
	await initializeDatabase();

	const now = new Date();
	const nowDb = (toMySQLDateTime(now) || new Date()) as any;
	const nowSql = nowDb;

	await db
		.insert(schema.panel)
		.values({ slug: 'default', created_at: nowDb, updated_at: nowDb })
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
	await db
		.insert(schema.panel)
		.values({ slug: 'demo', created_at: nowDb, updated_at: nowDb })
		.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

	const demoPanel = await db
		.select()
		.from(schema.panel)
		.where(sql`${schema.panel.slug} = 'demo'`)
		.limit(1)
		.then((r: any[]) => r[0] ?? null);
	if (!demoPanel?.id) throw new Error('Failed to ensure demo panel');

	const pwHash = await bcrypt.hash(`demo-${now.getUTCFullYear()}`, 10);
	await db
		.insert(schema.accounts)
		.values({
			username: DEMO.demoSuperadmin.username,
			email: DEMO.demoSuperadmin.email,
			password_hash: pwHash,
			account_type: 'superadmin',
			email_verified: true,
			otp_code: null,
			otp_expires_at: null,
			panel_id: demoPanel.id,
			ip_address: null,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({ set: { email_verified: true as any, panel_id: demoPanel.id as any, updated_at: nowDb } });

	const demoAdmin = await db
		.select()
		.from(schema.accounts)
		.where(sql`${schema.accounts.username} = ${DEMO.demoSuperadmin.username}`)
		.limit(1)
		.then((r: any[]) => r[0] ?? null);
	if (!demoAdmin?.id) throw new Error('Failed to ensure demo superadmin');

	await db
		.insert(schema.bots)
		.values({
			name: DEMO.demoBot.name,
			token: DEMO.demoBot.token,
			application_id: DEMO.demoBot.application_id,
			bot_icon: null,
			port: DEMO.demoBot.port,
			secret_key: DEMO.demoBot.secret_key,
			account_id: demoAdmin.id,
			status: 'stopped',
			process_id: null,
			uptime_started_at: null,
			created_at: nowDb,
			updated_at: nowDb
		})
		.onDuplicateKeyUpdate({
			set: {
				name: DEMO.demoBot.name as any,
				account_id: demoAdmin.id as any,
				updated_at: nowDb
			}
		});

	const botRow = await db
		.select()
		.from(schema.bots)
		.where(sql`${schema.bots.application_id} = ${DEMO.demoBot.application_id}`)
		.limit(1)
		.then((r: any[]) => r[0] ?? null);

	if (!botRow?.id) throw new Error('Failed to ensure demo bot');

	const base = Date.now();
	const firstNames = [
		'Aurora',
		'Kai',
		'Luna',
		'Nova',
		'Axel',
		'Mika',
		'Sora',
		'Jade',
		'Rin',
		'Zara',
		'Theo',
		'Iris',
		'Milo',
		'Niko',
		'Ruby',
		'Skye',
		'Vale',
		'Ember',
		'Rowan',
		'Wren'
	];
	const lastNames = ['Fox', 'Stone', 'River', 'Hart', 'Blaze', 'Storm', 'Woods', 'Reed', 'Knight', 'Ray'];

	function rngFor(serverIndex: number) {
		return (n: number) => (serverIndex * 9301 + n * 49297 + 233280) % 1_000_000;
	}

	const serverIds: number[] = [];

	for (let s = 1; s <= DEMO.serverCount; s++) {
		const discordServerId = `demo_server_${String(s).padStart(4, '0')}`;
		const serverName = `Dansday Demo Server ${s}`;

		await db.execute(sql`
			INSERT INTO servers
				(bot_id, discord_server_id, name, total_members, total_channels, total_boosters, boost_level, server_icon, discord_created_at, vanity_url_code, invite_code, created_at, updated_at)
			VALUES
				(${botRow.id}, ${discordServerId}, ${serverName}, 0, 0, 0, 0, NULL, NULL, NULL, NULL, ${nowSql}, ${nowSql})
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
			.then((r: any[]) => r[0] ?? null);
		if (!serverRow?.id) throw new Error(`Failed to ensure demo server ${s}`);
		serverIds.push(serverRow.id);

		const slug = slugifySimple(`${DEMO.publicSlugPrefix}-${s}`);
		await db
			.insert(schema.serverSettings)
			.values({
				server_id: serverRow.id,
				component_name: SERVER_SETTINGS.component.public_statistics,
				settings: { enabled: true, slug },
				created_at: nowDb,
				updated_at: nowDb
			})
			.onDuplicateKeyUpdate({
				set: {
					settings: sql`JSON_SET(COALESCE(${schema.serverSettings.settings}, JSON_OBJECT()), '$.enabled', true, '$.slug', ${slug})`,
					updated_at: nowDb
				}
			});

		await db
			.insert(schema.serverCategories)
			.values([
				{
					server_id: serverRow.id,
					discord_category_id: `demo${s}_cat_info`,
					name: 'Information',
					position: 3,
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_category_id: `demo${s}_cat_chat`,
					name: 'Community',
					position: 2,
					created_at: nowDb,
					updated_at: nowDb
				},
				{ server_id: serverRow.id, discord_category_id: `demo${s}_cat_voice`, name: 'Voice', position: 1, created_at: nowDb, updated_at: nowDb }
			])
			.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

		await db
			.insert(schema.serverRoles)
			.values([
				{
					server_id: serverRow.id,
					discord_role_id: `demo${s}_role_admin`,
					name: 'Admin',
					position: 4,
					color: '#ff4d4d',
					permissions: '0',
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_role_id: `demo${s}_role_mod`,
					name: 'Moderator',
					position: 3,
					color: '#4d7cff',
					permissions: '0',
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_role_id: `demo${s}_role_vip`,
					name: 'VIP',
					position: 2,
					color: '#f5b942',
					permissions: '0',
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_role_id: `demo${s}_role_member`,
					name: 'Member',
					position: 1,
					color: '#7b7b7b',
					permissions: '0',
					created_at: nowDb,
					updated_at: nowDb
				}
			])
			.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

		const categories = await db
			.select()
			.from(schema.serverCategories)
			.where(sql`${schema.serverCategories.server_id} = ${serverRow.id}`);
		const catId = (discordId: string) => categories.find((c: any) => c.discord_category_id === discordId)?.id ?? null;

		await db
			.insert(schema.serverChannels)
			.values([
				{
					server_id: serverRow.id,
					discord_channel_id: `demo${s}_ch_rules`,
					name: 'rules',
					type: 'guild_text',
					category_id: catId(`demo${s}_cat_info`),
					position: 3,
					notification_role_id: null,
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_channel_id: `demo${s}_ch_ann`,
					name: 'announcements',
					type: 'guild_announcement',
					category_id: catId(`demo${s}_cat_info`),
					position: 2,
					notification_role_id: null,
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_channel_id: `demo${s}_ch_general`,
					name: 'general',
					type: 'guild_text',
					category_id: catId(`demo${s}_cat_chat`),
					position: 1,
					notification_role_id: null,
					created_at: nowDb,
					updated_at: nowDb
				},
				{
					server_id: serverRow.id,
					discord_channel_id: `demo${s}_vc_lounge`,
					name: 'Lounge',
					type: 'guild_voice',
					category_id: catId(`demo${s}_cat_voice`),
					position: 1,
					notification_role_id: null,
					created_at: nowDb,
					updated_at: nowDb
				}
			])
			.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

		const selfbotCount = 1 + (rngFor(s)(serverRow.id) % 5);
		await db
			.insert(schema.serverBots)
			.values(
				Array.from({ length: selfbotCount }).map((_, i) => ({
					server_id: serverRow.id,
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

		const ownerUser = `demo_owner_${s}`;
		const ownerEmail = `demo_owner_${s}@dansday.local`;
		const ownerPw = await bcrypt.hash('demo', 10);
		await db
			.insert(schema.serverAccounts)
			.values({
				server_id: serverRow.id,
				username: ownerUser,
				email: ownerEmail,
				password_hash: ownerPw,
				account_type: 'owner',
				email_verified: true,
				otp_code: null,
				otp_expires_at: null,
				ip_address: null,
				is_frozen: false,
				created_at: nowDb,
				updated_at: nowDb
			})
			.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });

		const moderatorCount = 1 + (rngFor(s)(serverRow.id + 77) % 10);
		for (let m = 1; m <= moderatorCount; m++) {
			const u = `demo_mod_${s}_${m}`;
			const e = `demo_mod_${s}_${m}@dansday.local`;
			const pw = await bcrypt.hash('demo', 10);
			await db
				.insert(schema.serverAccounts)
				.values({
					server_id: serverRow.id,
					username: u,
					email: e,
					password_hash: pw,
					account_type: 'moderator',
					email_verified: true,
					otp_code: null,
					otp_expires_at: null,
					ip_address: null,
					is_frozen: false,
					created_at: nowDb,
					updated_at: nowDb
				})
				.onDuplicateKeyUpdate({ set: { updated_at: nowDb } });
		}

		const seededCount = DEMO.membersPerServerMin + (rngFor(s)(serverRow.id) % (DEMO.membersPerServerMax - DEMO.membersPerServerMin + 1));

		const membersToSeed = Array.from({ length: seededCount }).map((_, i) => {
			const n = i + 1;
			const id = `demo${s}_user_${String(n).padStart(4, '0')}`;
			const baseName = `${firstNames[i % firstNames.length]}${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}${s}${n}`;
			const withAfkPrefix = n % 17 === 0 || n === 7;
			const username = withAfkPrefix ? `[AFK] ${baseName}` : baseName;

			const exp = Math.max(0, Math.round(120_000 / (1 + i * 0.07)) + (i % 9) * 133 - i * 31);
			const lvl = Math.max(1, Math.round(exp / 650));
			const hasAfkRow = n % 13 === 0;
			return {
				discord_member_id: id,
				username,
				display_name: `Demo ${username}`,
				server_display_name: n % 5 === 0 ? `[AFK] ${firstNames[(i + 3) % firstNames.length]}-${n}` : `${firstNames[(i + 3) % firstNames.length]}-${n}`,
				avatar: null,
				profile_created_at: toMySQLDateTime(new Date(base - n * 86400000)) as any,
				member_since: toMySQLDateTime(new Date(base - n * 43200000)) as any,
				is_booster: n % 9 === 0,
				booster_since: n % 9 === 0 ? (toMySQLDateTime(new Date(base - n * 22200000)) as any) : (null as any),
				language: 'en',
				created_at: nowDb,
				updated_at: nowDb,
				level: {
					chat_total: Math.max(0, 22_000 - i * 83 + (i % 7) * 41),
					voice_minutes_total: Math.max(0, 48_000 - i * 177 + (i % 11) * 97),
					voice_minutes_active: Math.max(0, 36_000 - i * 141 + (i % 10) * 71),
					voice_minutes_afk: Math.max(0, 12_000 - i * 41 + (i % 8) * 23),
					voice_minutes_video: Math.max(0, 3_200 - i * 9 + (i % 6) * 7),
					voice_minutes_streaming: Math.max(0, 1_100 - i * 4 + (i % 9) * 5),
					experience: exp,
					level: lvl,
					dm_notifications_enabled: true,
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
				},
				afk: hasAfkRow ? { message: 'Stepped out for a bit', created_at: nowDb, updated_at: nowDb } : null
			};
		});

		for (const m of membersToSeed) {
			await db
				.insert(schema.serverMembers)
				.values({
					server_id: serverRow.id,
					discord_member_id: m.discord_member_id,
					username: m.username,
					display_name: m.display_name,
					server_display_name: m.server_display_name,
					avatar: m.avatar,
					profile_created_at: m.profile_created_at,
					member_since: m.member_since,
					is_booster: m.is_booster,
					booster_since: m.booster_since as any,
					language: m.language,
					created_at: nowDb,
					updated_at: nowDb
				})
				.onDuplicateKeyUpdate({
					set: {
						username: m.username as any,
						display_name: m.display_name as any,
						server_display_name: m.server_display_name as any,
						is_booster: (m.is_booster ?? false) as any,
						updated_at: nowDb
					}
				});

			const memberRow = await db
				.select({ id: schema.serverMembers.id })
				.from(schema.serverMembers)
				.where(sql`${schema.serverMembers.server_id} = ${serverRow.id} AND ${schema.serverMembers.discord_member_id} = ${m.discord_member_id}`)
				.limit(1)
				.then((r: any[]) => r[0] ?? null);

			if (!memberRow?.id) continue;

			await db
				.insert(schema.serverMemberLevels)
				.values({ member_id: memberRow.id as any, ...(m.level as any) })
				.onDuplicateKeyUpdate({
					set: {
						chat_total: m.level.chat_total as any,
						voice_minutes_total: m.level.voice_minutes_total as any,
						voice_minutes_active: m.level.voice_minutes_active as any,
						voice_minutes_afk: m.level.voice_minutes_afk as any,
						experience: m.level.experience as any,
						level: m.level.level as any,
						updated_at: nowDb
					}
				});

			if (m.afk) {
				await db
					.insert(schema.serverMemberAfks)
					.values({ member_id: memberRow.id as any, message: m.afk.message, created_at: nowDb, updated_at: nowDb })
					.onDuplicateKeyUpdate({ set: { message: m.afk.message as any, updated_at: nowDb } });
			}
		}

		await db.execute(sql`
		UPDATE servers
		SET
			total_members = (SELECT COUNT(*) FROM server_members WHERE server_id = ${serverRow.id}),
			total_channels = (SELECT COUNT(*) FROM server_channels WHERE server_id = ${serverRow.id}),
			total_boosters = (SELECT COUNT(*) FROM server_members WHERE server_id = ${serverRow.id} AND is_booster = 1),
			updated_at = ${nowDb}
		WHERE id = ${serverRow.id}
	`);
	}

	return { bot_id: botRow.id, superadmin_account_id: demoAdmin.id, server_ids: serverIds };
}

export async function cleanupDemoData(): Promise<void> {
	await initializeDatabase();
	await db.delete(schema.panel).where(sql`${schema.panel.slug} = 'demo'`);
}
