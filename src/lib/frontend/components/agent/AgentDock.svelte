<script lang="ts">
	import { tick } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { AGENT_OFF, AGENT_PROMPT_LIMIT } from '$lib/agent.js';
	import { agentDock, announceAgentChanges, type AgentMessageEditor } from '$lib/frontend/agent.svelte';
	import { ADMIN_TAB_PATHS } from '$lib/frontend/redirect.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import { FIELD, GHOST_BUTTON, ICON_BUTTON } from '$lib/frontend/components/messages/styles.js';

	type Confirm = { name: string; args: Record<string, unknown>; label: string };
	type Turn = { role: 'user' | 'assistant'; text: string; confirms: Confirm[] };

	let { superadmin }: { superadmin: boolean } = $props();

	let open = $state(false);
	let ready = $state<boolean | null>(null);
	let can = $state<string[]>([]);
	let turns = $state<Turn[]>([]);
	let prompt = $state('');
	let busy = $state(false);
	let undoable = $state.raw<{ turn: number; editor: AgentMessageEditor } | null>(null);
	let log = $state<HTMLElement>();
	let input = $state<HTMLTextAreaElement>();

	const serverId = $derived(page.params.serverId ? Number(page.params.serverId) : null);
	const editor = $derived(agentDock.editor);

	$effect(() => {
		if (!open) return;
		const query = new URLSearchParams();
		if (serverId) query.set('server_id', String(serverId));
		if (editor) query.set('message', editor.scope);
		let current = true;
		fetch(`/api/agent?${query}`)
			.then((res) => res.json())
			.then((out) => {
				if (!current) return;
				ready = out.ok === true && out.ready === true;
				can = Array.isArray(out.can) ? out.can : [];
			})
			.catch(() => {
				if (current) ready = false;
			});
		return () => {
			current = false;
		};
	});

	async function show() {
		open = true;
		await tick();
		input?.focus();
	}

	async function scrollDown() {
		await tick();
		log?.scrollTo({ top: log.scrollHeight });
	}

	async function call(body: Record<string, unknown>): Promise<any | null> {
		try {
			const res = await fetch('/api/agent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...body, server_id: serverId })
			});
			const out = await res.json().catch(() => ({}));
			if (res.ok && out.ok) return out;
			showToast(out.error || 'The assistant request failed. Try again in a moment.', 'error', 8000);
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

	async function ask() {
		const text = prompt.trim();
		if (!text || busy || !ready) return;
		busy = true;
		scrollDown();
		try {
			const out = await call({
				prompt: text,
				history: turns.map((turn) => ({ role: turn.role, text: turn.text })),
				message: editor ? { scope: editor.scope, ...editor.read() } : null
			});
			if (!out) return;
			turns.push(
				{ role: 'user', text, confirms: [] },
				{ role: 'assistant', text: String(out.reply ?? ''), confirms: Array.isArray(out.confirms) ? out.confirms : [] }
			);
			if (out.message && editor?.apply(out.message)) undoable = { turn: turns.length - 1, editor };
			prompt = '';
			await settle(out);
		} finally {
			busy = false;
			scrollDown();
		}
	}

	async function confirm(turn: Turn, action: Confirm) {
		if (busy) return;
		busy = true;
		try {
			const out = await call({ confirm: { name: action.name, args: action.args } });
			if (!out) return;
			turn.confirms = turn.confirms.filter((other) => other !== action);
			turns.push({ role: 'assistant', text: String(out.reply ?? ''), confirms: [] });
			await settle(out);
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
						{#each turn.confirms as action (action.label)}
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									disabled={busy}
									onclick={() => confirm(turn, action)}
									class="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-left text-xs font-medium text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
								>
									<i class="fas fa-trash text-red-200"></i>{action.label}
								</button>
								<button type="button" class={GHOST_BUTTON} disabled={busy} onclick={() => (turn.confirms = turn.confirms.filter((other) => other !== action))}>
									Keep it
								</button>
							</div>
						{/each}
						{#if undoable?.turn === i && undoable.editor === editor}
							<button type="button" class="{GHOST_BUTTON} self-start" disabled={busy} onclick={undo}>
								<i class="fas fa-rotate-left"></i>Undo this change
							</button>
						{/if}
					</div>
				{/if}
			{/each}

			{#if busy}
				<p class="text-ash-400 flex items-center gap-2 self-start text-sm"><i class="fas fa-spinner fa-spin"></i>Working. This can take up to a minute.</p>
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
				class="{FIELD} min-w-0 flex-1 resize-none disabled:cursor-not-allowed disabled:opacity-60"
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
	<button
		type="button"
		aria-label="Open the assistant"
		onclick={show}
		class="bg-ash-700 hover:bg-ash-600 border-ash-500 fixed right-4 bottom-4 z-30 grid size-12 place-items-center rounded-full border text-fuchsia-300 shadow-xl transition-colors"
	>
		<i class="fas fa-wand-magic-sparkles"></i>
	</button>
{/if}
