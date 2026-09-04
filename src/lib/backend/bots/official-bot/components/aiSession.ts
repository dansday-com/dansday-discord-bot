import { getRedisClient } from '../../../../redis.js';

const SESSION_TTL_SEC = 30 * 60;
const SEEN_TTL_SEC = 10 * 60;
const MAX_STORED = 40;

const sessions = new Map<string, { messages: { role: string; content: string }[]; expiresAt: number }>();
const seen = new Map<string, number>();

function sessionKey(botId, guildId, memberId) {
	return `botai:msg:${botId}:${guildId}:${memberId}`;
}

function seenKey(botId, messageId) {
	return `botai:seen:${botId}:${messageId}`;
}

function pruneSessions() {
	const now = Date.now();
	for (const [key, entry] of sessions) if (now >= entry.expiresAt) sessions.delete(key);
}

function readLocal(key, limit) {
	pruneSessions();
	const entry = sessions.get(key);
	if (!entry) return [];
	entry.expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
	return entry.messages.slice(-limit);
}

function appendLocal(key, message) {
	pruneSessions();
	const entry = sessions.get(key) ?? { messages: [], expiresAt: 0 };
	entry.messages.push(message);
	if (entry.messages.length > MAX_STORED) entry.messages = entry.messages.slice(-MAX_STORED);
	entry.expiresAt = Date.now() + SESSION_TTL_SEC * 1000;
	sessions.set(key, entry);
}

function parseMessages(raw) {
	return raw
		.map((entry) => {
			try {
				const parsed = JSON.parse(entry);
				return parsed?.role && typeof parsed.content === 'string' ? { role: parsed.role, content: parsed.content } : null;
			} catch {
				return null;
			}
		})
		.filter(Boolean);
}

export async function readAiSession(botId, guildId, memberId, limit = 20) {
	const key = sessionKey(botId, guildId, memberId);
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return readLocal(key, limit);

	try {
		const [raw] = await redis.multi().lRange(key, -limit, -1).expire(key, SESSION_TTL_SEC).exec();
		return parseMessages(Array.isArray(raw) ? raw : []);
	} catch {
		return readLocal(key, limit);
	}
}

export async function appendAiMessage(botId, guildId, memberId, role, content) {
	const key = sessionKey(botId, guildId, memberId);
	const message = { role, content };

	const redis = await getRedisClient().catch(() => null);
	if (!redis) {
		appendLocal(key, message);
		return;
	}

	try {
		await redis.multi().rPush(key, JSON.stringify(message)).lTrim(key, -MAX_STORED, -1).expire(key, SESSION_TTL_SEC).exec();
	} catch {
		appendLocal(key, message);
	}
}

export async function clearAiSession(botId, guildId, memberId) {
	const key = sessionKey(botId, guildId, memberId);
	sessions.delete(key);

	const redis = await getRedisClient().catch(() => null);
	if (!redis) return;
	try {
		await redis.del(key);
	} catch {}
}

export function claimAiMessageLocal(botId, messageId) {
	const key = seenKey(botId, messageId);
	const now = Date.now();
	for (const [id, at] of seen) if (now - at > SEEN_TTL_SEC * 1000) seen.delete(id);
	if (seen.has(key)) return false;
	seen.set(key, now);
	return true;
}

export async function claimAiMessageShared(botId, messageId) {
	const redis = await getRedisClient().catch(() => null);
	if (!redis) return true;
	try {
		const claimed = await redis.set(seenKey(botId, messageId), '1', { NX: true, EX: SEEN_TTL_SEC });
		return claimed === 'OK';
	} catch {
		return true;
	}
}

export default { readAiSession, appendAiMessage, clearAiSession, claimAiMessageLocal, claimAiMessageShared };
