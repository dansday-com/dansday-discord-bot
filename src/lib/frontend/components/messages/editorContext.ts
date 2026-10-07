import { getContext, setContext } from 'svelte';
import type { ServerLanguage } from '$lib/languages.js';

export type EditorEmoji = { id: string; name: string; animated: boolean };
export type EditorRole = { id: string; name: string; color: string | null; assignable?: boolean };
export type EditorMessage = { id: number; name: string };

export type MessageEditorContext = {
	lang: ServerLanguage;
	base: ServerLanguage;
	uploadUrl: string;
	uploadLimit: number;
	uploadLimitNote: string;
	colorNote: string;
	roleActions: boolean;
	selfId: number | null;
	emojis: EditorEmoji[];
	roles: EditorRole[];
	messages: EditorMessage[];
};

const KEY = Symbol('message-editor');

export function setMessageEditor(context: MessageEditorContext) {
	setContext(KEY, context);
}

export function messageEditor(): MessageEditorContext {
	return getContext<MessageEditorContext>(KEY);
}

export function moveItem<T>(items: T[], index: number, delta: number) {
	const target = index + delta;
	if (target < 0 || target >= items.length) return;
	const [item] = items.splice(index, 1);
	items.splice(target, 0, item);
}

export function clickOutside(node: HTMLElement, onoutside: () => void) {
	let handler = onoutside;
	const listener = (event: PointerEvent) => {
		if (event.target instanceof Node && !node.contains(event.target)) handler();
	};
	document.addEventListener('pointerdown', listener, true);
	return {
		update(next: () => void) {
			handler = next;
		},
		destroy() {
			document.removeEventListener('pointerdown', listener, true);
		}
	};
}
