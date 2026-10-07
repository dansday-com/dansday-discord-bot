import { AGENT_CHANGED_EVENT } from '$lib/agent.js';
import type { MessageDoc, MessageScope } from '$lib/messages.js';

export type AgentMessageEditor = {
	scope: MessageScope;
	read: () => { id: number | null; name: string; content: MessageDoc };
	apply: (result: { name: string | null; content: MessageDoc | null }) => boolean;
	undo: () => void;
};

let editor = $state.raw<AgentMessageEditor | null>(null);

export const agentDock = {
	get editor() {
		return editor;
	},
	set editor(next: AgentMessageEditor | null) {
		editor = next;
	}
};

export function announceAgentChanges(kinds: string[]) {
	if (kinds.length > 0) window.dispatchEvent(new CustomEvent(AGENT_CHANGED_EVENT, { detail: kinds }));
}

export function onAgentChange(kind: string, run: () => void): () => void {
	const listener = (event: Event) => {
		if (((event as CustomEvent).detail as string[]).includes(kind)) run();
	};
	window.addEventListener(AGENT_CHANGED_EVENT, listener);
	return () => window.removeEventListener(AGENT_CHANGED_EVENT, listener);
}
