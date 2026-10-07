<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { quintOut } from 'svelte/easing';
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { AGENT_OFF, AGENT_PROMPT_LIMIT } from '$lib/agent.js';
	import { agentDock, announceAgentChanges, type AgentMessageEditor } from '$lib/frontend/agent.svelte';
	import { ADMIN_TAB_PATHS } from '$lib/frontend/redirect.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON } from '$lib/frontend/components/messages/styles.js';

	type Turn = { role: 'user' | 'assistant'; text: string };

	const SEEN_KEY = 'agent-dock-seen';
	const TEASER_DELAY_MS = 6000;

	const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	let { superadmin }: { superadmin: boolean } = $props();

	let open = $state(false);
	let ready = $state<boolean | null>(null);
	let can = $state<string[]>([]);
	let turns = $state<Turn[]>([]);
	let prompt = $state('');
	let busy = $state(false);
	let teaser = $state(false);
	let unread = $state(false);
	let undoable = $state.raw<{ turn: number; editor: AgentMessageEditor } | null>(null);
	let log = $state<HTMLElement>();
	let input = $state<HTMLTextAreaElement>();

	const serverId = $derived(page.params.serverId ? Number(page.params.serverId) : null);
	const editor = $derived(agentDock.editor);
	const teaserText = $derived(
		editor
			? "Describe this message and I'll build it for you."
			: superadmin
				? "Need a message, a wiki or a shop item? Tell me and I'll set it up."
				: 'Need a message built, or numbers from your server? Just ask.'
	);

	function pop(_node: Element, { duration, lift = 0 }: { duration: number; lift?: number }) {
		return {
			duration,
			easing: quintOut,
			css: (t: number, u: number) =>
				reduced ? `opacity: ${t}` : `opacity: ${t}; transform: translateY(${u * lift}px) scale(${0.96 + 0.04 * t}); transform-origin: bottom right`
		};
	}

	async function describe(): Promise<{ ready: boolean; can: string[] }> {
		const query = new URLSearchParams();
		if (serverId) query.set('server_id', String(serverId));
		if (editor) query.set('message', editor.scope);
		try {
			const out = await (await fetch(`/api/agent?${query}`)).json();
			return { ready: out.ok === true && out.ready === true, can: Array.isArray(out.can) ? out.can : [] };
		} catch (_) {
			return { ready: false, can: [] };
		}
	}

	$effect(() => {
		if (!open) return;
		let current = true;
		describe().then((info) => {
			if (!current) return;
			ready = info.ready;
			can = info.can;
		});
		return () => {
			current = false;
		};
	});

	function seen(): boolean {
		try {
			return localStorage.getItem(SEEN_KEY) === '1';
		} catch (_) {
			return true;
		}
	}

	function markSeen() {
		teaser = false;
		try {
			localStorage.setItem(SEEN_KEY, '1');
		} catch (_) {}
	}

	onMount(() => {
		if (seen()) return;
		const timer = setTimeout(async () => {
			const info = await describe();
			if (info.ready && !open && !seen()) teaser = true;
		}, TEASER_DELAY_MS);
		return () => clearTimeout(timer);
	});

	async function show() {
		markSeen();
		unread = false;
		open = true;
		await tick();
		input?.focus();
	}

	async function scrollDown() {
		await tick();
		log?.scrollTo({ top: log.scrollHeight });
	}

	async function readAnswer(res: Response): Promise<{ ok: boolean; body: any }> {
		if (!res.headers.get('content-type')?.includes('text/event-stream')) return { ok: res.ok, body: await res.json().catch(() => ({})) };
		const line = (await res.text())
			.split('\n')
			.reverse()
			.find((entry) => entry.startsWith('data: '));
		const payload = line ? JSON.parse(line.slice(6)) : { status: 502, body: {} };
		return { ok: payload.status < 400, body: payload.body ?? {} };
	}

	async function call(body: Record<string, unknown>): Promise<any | null> {
		try {
			const res = await fetch('/api/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...body, server_id: serverId })
			});
			const answer = await readAnswer(res);
			if (answer.ok && answer.body.ok) return answer.body;
			showToast(answer.body.error || 'The assistant request failed. Try again in a moment.', 'error', 8000);
		} catch {
			showToast('Could not reach the panel. Check your connection and try again.', 'error', 8000);
		}
		return null;
	}

	async function settle(out: any) {
		const changed: string[] = Array.isArray(out.changed) ? out.changed : [];
		if (changed.length === 0) return;
		announceAgentChanges(changed);
		await invalidateAll();
	}

	async function exchange(text: string, showPrompt: boolean): Promise<any | null> {
		const target = agentDock.editor;
		const out = await call({
			prompt: text,
			history: turns.map((turn) => ({ role: turn.role, text: turn.text })),
			message: target ? { scope: target.scope, ...target.read() } : null
		});
		if (!out) return null;
		if (showPrompt) turns.push({ role: 'user', text });
		turns.push({ role: 'assistant', text: String(out.reply ?? '') });
		if (!open) unread = true;
		if (out.message && target?.apply(out.message)) undoable = { turn: turns.length - 1, editor: target };
		scrollDown();
		await settle(out);
		return out;
	}

	async function editorOpened(): Promise<boolean> {
		for (let i = 0; i < 100 && !agentDock.editor; i++) await new Promise((resolve) => setTimeout(resolve, 50));
		return agentDock.editor !== null;
	}

	async function ask() {
		const text = prompt.trim();
		if (!text || busy || !ready) return;
		busy = true;
		scrollDown();
		try {
			const out = await exchange(text, true);
			if (!out) return;
			prompt = '';
			if (typeof out.navigate !== 'string' || !out.navigate.startsWith('/admin/')) return;
			await goto(out.navigate);
			if (await editorOpened()) await exchange(text, false);
		} finally {
			busy = false;
			scrollDown();
		}
	}

	function undo() {
		undoable?.editor.undo();
		undoable = null;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && open) open = false;
	}}
/>

{#if open}
	<section
		in:pop={{ duration: 200 }}
		out:pop={{ duration: 150 }}
		role="dialog"
		aria-label="Assistant"
		class="bg-ash-800 border-ash-700 fixed right-3 bottom-3 z-50 flex h-[min(34rem,calc(100dvh-5.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-xl border shadow-2xl"
	>
		<header class="border-ash-700 flex items-center justify-between gap-2 border-b px-4 py-3">
			<h2 class="text-ash-100 flex min-w-0 items-center gap-2 text-sm font-semibold">
				<i class="fas fa-wand-magic-sparkles text-fuchsia-300"></i><span class="truncate">Assistant</span>
			</h2>
			<button type="button" class={ICON_BUTTON} aria-label="Close the assistant" onclick={() => (open = false)}><i class="fas fa-xmark"></i></button>
		</header>

		<div bind:this={log} class="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
			{#if ready === false}
				<p class="text-ash-300 text-sm">{AGENT_OFF}</p>
				{#if superadmin}
					<a href={ADMIN_TAB_PATHS.ai} class="{GHOST_BUTTON} self-start" onclick={() => (open = false)}
						><i class="fas fa-robot text-emerald-400"></i>Open AI settings</a
					>
				{/if}
			{:else if turns.length === 0 && can.length > 0}
				<p class="text-ash-300 text-sm">Tell me what you need. From here I can:</p>
				<ul class="flex flex-col gap-1.5">
					{#each can as line (line)}
						<li class="text-ash-200 flex items-start gap-2 text-sm"><i class="fas fa-check mt-1 text-xs text-emerald-400"></i><span>{line}</span></li>
					{/each}
				</ul>
			{/if}

			{#each turns as turn, i (i)}
				{#if turn.role === 'user'}
					<p class="bg-ash-600 text-ash-100 max-w-[85%] self-end rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap">{turn.text}</p>
				{:else}
					<div class="flex max-w-[92%] flex-col gap-2 self-start">
						<p class="bg-ash-700 text-ash-100 rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap">{turn.text}</p>
						{#if undoable?.turn === i && undoable.editor === editor}
							<button type="button" class="{GHOST_BUTTON} self-start" disabled={busy} onclick={undo}>
								<i class="fas fa-rotate-left"></i>Undo this change
							</button>
						{/if}
					</div>
				{/if}
			{/each}

			{#if busy}
				<p class="text-ash-400 flex items-center gap-2 self-start text-sm">
					<i class="fas fa-spinner fa-spin"></i>Working. A long message can take a few minutes.
				</p>
			{/if}
		</div>

		<form
			class="border-ash-700 flex items-end gap-2 border-t p-3"
			onsubmit={(event) => {
				event.preventDefault();
				ask();
			}}
		>
			<textarea
				bind:this={input}
				bind:value={prompt}
				rows="2"
				maxlength={AGENT_PROMPT_LIMIT}
				disabled={!ready || busy}
				placeholder={editor ? 'Describe the message, or what to change' : 'What do you need?'}
				aria-label="Message to the assistant"
				class="{FIELD} field-sizing-content max-h-40 min-w-0 flex-1 resize-none overflow-y-auto disabled:cursor-not-allowed disabled:opacity-60"
				onkeydown={(event) => {
					if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
					event.preventDefault();
					ask();
				}}></textarea>
			<button
				type="submit"
				disabled={!ready || busy || !prompt.trim()}
				aria-label="Send"
				class="bg-ash-600 hover:bg-ash-500 text-ash-100 grid size-10 shrink-0 place-items-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50"
			>
				<i class="fas fa-paper-plane text-fuchsia-300"></i>
			</button>
		</form>
	</section>
{:else}
	{#if teaser}
		<div
			in:pop={{ duration: 260, lift: 8 }}
			out:pop={{ duration: 150, lift: 8 }}
			class="bg-ash-700 border-ash-500 fixed right-4 bottom-20 z-30 flex max-w-[min(18rem,calc(100vw-2rem))] items-start gap-1 rounded-xl rounded-br-sm border py-2 pr-1.5 pl-3 shadow-xl"
		>
			<button type="button" class="text-ash-100 py-1 text-left text-sm" onclick={show}>{teaserText}</button>
			<button type="button" class={ICON_BUTTON} aria-label="Dismiss" onclick={markSeen}><i class="fas fa-xmark"></i></button>
		</div>
	{/if}
	<button
		type="button"
		aria-label="Ask the AI assistant"
		onclick={show}
		class="fixed right-4 bottom-4 z-30 inline-flex h-12 w-12 items-center justify-center gap-2 rounded-full bg-linear-to-br from-fuchsia-600 to-violet-600 text-sm font-semibold text-white shadow-xl shadow-black/40 transition-[filter,scale] duration-150 ease-out hover:brightness-110 active:scale-[0.97] sm:w-auto sm:px-5"
	>
		<i class="fas {busy ? 'fa-spinner fa-spin' : 'fa-wand-magic-sparkles'}"></i>
		<span class="hidden sm:inline">Ask AI</span>
		{#if unread}
			<span class="ring-ash-950 absolute -top-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-400 ring-2"></span>
		{/if}
	</button>
{/if}
