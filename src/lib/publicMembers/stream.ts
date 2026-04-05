import { getServerMembersList } from '../database.js';

export type PublicMembersStreamPayload = {
	members: NonNullable<Awaited<ReturnType<typeof getServerMembersList>>>;
	updated_at: number;
};

type Listener = (payload: PublicMembersStreamPayload) => void;

type StreamState = {
	listeners: Set<Listener>;
	timer: ReturnType<typeof setInterval> | null;
	lastJson: string | null;
};

const streams = new Map<number, StreamState>();

const POLL_MS = 10_000;

async function fetchMembers(serverId: number): Promise<PublicMembersStreamPayload> {
	const members = await getServerMembersList(serverId);
	return { members: members ?? [], updated_at: Date.now() };
}

export function subscribePublicMembersList(serverId: number, fn: Listener): () => void {
	let state = streams.get(serverId);
	if (!state) {
		state = { listeners: new Set(), timer: null, lastJson: null };
		streams.set(serverId, state);
	}
	state.listeners.add(fn);
	if (state.lastJson) {
		try {
			fn(JSON.parse(state.lastJson) as PublicMembersStreamPayload);
		} catch (_) {}
	}

	if (!state.timer) {
		state.timer = setInterval(async () => {
			const current = streams.get(serverId);
			if (!current || current.listeners.size === 0) return;
			try {
				const payload = await fetchMembers(serverId);
				const json = JSON.stringify(payload);
				if (json === current.lastJson) return;
				current.lastJson = json;
				for (const l of current.listeners) l(payload);
			} catch (_) {}
		}, POLL_MS);

		(async () => {
			const current = streams.get(serverId);
			if (!current || current.listeners.size === 0) return;
			try {
				const payload = await fetchMembers(serverId);
				current.lastJson = JSON.stringify(payload);
				for (const l of current.listeners) l(payload);
			} catch (_) {}
		})();
	}

	return () => {
		const current = streams.get(serverId);
		if (!current) return;
		current.listeners.delete(fn);
		if (current.listeners.size === 0) {
			if (current.timer) clearInterval(current.timer);
			streams.delete(serverId);
		}
	};
}
