import { logger } from '../../../utils/index.js';

const DROPPED_EVENTS = new Set([
	'TYPING_START',
	'PRESENCE_UPDATE',
	'MESSAGE_UPDATE',
	'MESSAGE_DELETE',
	'MESSAGE_DELETE_BULK',
	'MESSAGE_ACK',
	'MESSAGE_REACTION_ADD',
	'MESSAGE_REACTION_REMOVE',
	'MESSAGE_REACTION_REMOVE_ALL',
	'MESSAGE_REACTION_REMOVE_EMOJI',
	'MESSAGE_POLL_VOTE_ADD',
	'MESSAGE_POLL_VOTE_REMOVE',
	'VOICE_STATE_UPDATE',
	'VOICE_SERVER_UPDATE',
	'VOICE_CHANNEL_STATUS_UPDATE',
	'GUILD_MEMBER_ADD',
	'GUILD_MEMBER_REMOVE',
	'GUILD_BAN_ADD',
	'GUILD_BAN_REMOVE',
	'GUILD_EMOJIS_UPDATE',
	'GUILD_STICKERS_UPDATE',
	'GUILD_INTEGRATIONS_UPDATE',
	'GUILD_AUDIT_LOG_ENTRY_CREATE',
	'GUILD_JOIN_REQUEST_CREATE',
	'GUILD_JOIN_REQUEST_UPDATE',
	'GUILD_JOIN_REQUEST_DELETE',
	'GUILD_SCHEDULED_EVENT_CREATE',
	'GUILD_SCHEDULED_EVENT_UPDATE',
	'GUILD_SCHEDULED_EVENT_DELETE',
	'GUILD_SCHEDULED_EVENT_USER_ADD',
	'GUILD_SCHEDULED_EVENT_USER_REMOVE',
	'GUILD_SOUNDBOARD_SOUND_CREATE',
	'GUILD_SOUNDBOARD_SOUND_UPDATE',
	'GUILD_SOUNDBOARD_SOUND_DELETE',
	'INVITE_CREATE',
	'INVITE_DELETE',
	'INTEGRATION_CREATE',
	'INTEGRATION_UPDATE',
	'INTEGRATION_DELETE',
	'INTERACTION_CREATE',
	'INTERACTION_SUCCESS',
	'INTERACTION_FAILURE',
	'INTERACTION_MODAL_CREATE',
	'WEBHOOKS_UPDATE',
	'STAGE_INSTANCE_CREATE',
	'STAGE_INSTANCE_UPDATE',
	'STAGE_INSTANCE_DELETE',
	'THREAD_MEMBER_UPDATE',
	'THREAD_MEMBERS_UPDATE',
	'AUTO_MODERATION_RULE_CREATE',
	'AUTO_MODERATION_RULE_UPDATE',
	'AUTO_MODERATION_RULE_DELETE',
	'AUTO_MODERATION_ACTION_EXECUTION',
	'EMBEDDED_ACTIVITY_UPDATE',
	'CALL_CREATE',
	'CALL_UPDATE',
	'CALL_DELETE',
	'CHANNEL_PINS_UPDATE',
	'CHANNEL_PINS_ACK',
	'CHANNEL_RECIPIENT_ADD',
	'CHANNEL_RECIPIENT_REMOVE',
	'RELATIONSHIP_ADD',
	'RELATIONSHIP_REMOVE',
	'RELATIONSHIP_UPDATE',
	'SESSIONS_REPLACE',
	'USER_GUILD_SETTINGS_UPDATE',
	'USER_SETTINGS_UPDATE',
	'USER_SETTINGS_PROTO_UPDATE',
	'USER_NOTE_UPDATE',
	'USER_REQUIRED_ACTION_UPDATE',
	'USER_CONNECTIONS_UPDATE',
	'USER_PAYMENT_SOURCES_UPDATE',
	'USER_SUBSCRIPTIONS_UPDATE',
	'PASSIVE_UPDATE_V1',
	'PASSIVE_UPDATE_V2',
	'READY_SUPPLEMENTAL',
	'CONTENT_INVENTORY_INBOX_STALE'
]);

type Stats = { seen: number; dropped: number; forwarded: number };

const stats: Stats = { seen: 0, dropped: 0, forwarded: 0 };
const STATS_INTERVAL_MS = 5 * 60 * 1000;

const NEVER_DROP = new Set(['READY', 'RESUMED', 'GUILD_CREATE', 'GUILD_DELETE', 'GUILD_UPDATE', 'GUILD_MEMBERS_CHUNK', 'USER_UPDATE']);

export function installPacketFilter(client: any, isForwardChannel: (guildId: string, channelId: string) => boolean | null): void {
	const manager = client?.ws;
	if (!manager || typeof manager.handlePacket !== 'function') {
		logger.log('⚠️  Packet filter NOT installed: websocket manager has no handlePacket. Selfbot will run unfiltered at full CPU.');
		return;
	}

	for (const critical of NEVER_DROP) {
		if (DROPPED_EVENTS.has(critical)) {
			logger.log(`⚠️  Packet filter NOT installed: ${critical} is in the drop list and the bot cannot work without it.`);
			return;
		}
	}

	const original = manager.handlePacket.bind(manager);
	const selfId = () => client.user?.id;

	function drop() {
		stats.dropped++;
		if (manager.packetQueue?.length) original();
		return true;
	}

	manager.handlePacket = function patchedHandlePacket(packet: any, shard: any) {
		if (!packet || !packet.t) return original(packet, shard);

		stats.seen++;

		if (DROPPED_EVENTS.has(packet.t)) return drop();

		if (packet.t === 'GUILD_MEMBER_UPDATE') {
			const own = selfId();
			if (own && packet.d?.user?.id && String(packet.d.user.id) !== String(own)) return drop();
		}

		if (packet.t === 'MESSAGE_CREATE') {
			const guildId = packet.d?.guild_id;
			const channelId = packet.d?.channel_id;
			if (!guildId) return drop();
			if (channelId && isForwardChannel(String(guildId), String(channelId)) === false) return drop();
			stats.forwarded++;
		}

		return original(packet, shard);
	};

	if (manager.handlePacket.name !== 'patchedHandlePacket') {
		logger.log('⚠️  Packet filter did not take effect: handlePacket was not replaced. Selfbot will run unfiltered at full CPU.');
		return;
	}

	const timer = setInterval(() => {
		if (stats.seen === 0) return;
		const pct = Math.round((stats.dropped / stats.seen) * 100);
		logger.log(`🧹 Packet filter: ${stats.dropped}/${stats.seen} gateway events dropped (${pct}%), ${stats.forwarded} message(s) in forwarded channels`);
		stats.seen = 0;
		stats.dropped = 0;
		stats.forwarded = 0;
	}, STATS_INTERVAL_MS);
	timer.unref?.();

	logger.log(`🧹 Packet filter installed: ${DROPPED_EVENTS.size} event type(s) dropped at the gateway`);
}
