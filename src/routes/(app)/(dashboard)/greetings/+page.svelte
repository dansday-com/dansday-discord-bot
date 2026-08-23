<script lang="ts">
	import { APP_NAME } from '$lib/frontend/panelServer.js';
	import { showToast } from '$lib/frontend/toast.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let search = $state('');
	let sending = $state('');
	let justGreeted = $state<string[]>([]);

	const isGreeted = (s: { discord_server_id: string; greeted_at: unknown }) => !!s.greeted_at || justGreeted.includes(s.discord_server_id);

	const pending = $derived(data.servers.filter((s) => !isGreeted(s)));

	const matches = $derived(
		data.servers.filter((s) => {
			const q = search.trim().toLowerCase();
			if (!q) return true;
			return s.name.toLowerCase().includes(q) || s.discord_server_id.includes(q);
		})
	);

	async function send(guildId: string) {
		sending = guildId;
		try {
			const res = await fetch('/api/admin/resend-greeting', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ guild_id: guildId })
			});
			let d: { success?: boolean; error?: string; bot_name?: string } = {};
			try {
				d = await res.json();
			} catch {
				showToast('Could not read the server response. Try again.', 'error');
				return;
			}
			if (d.success) {
				if (!justGreeted.includes(guildId)) justGreeted = [...justGreeted, guildId];
				showToast(`Greeting sent via ${d.bot_name}`, 'success');
			} else showToast(d.error || 'Failed to send the greeting', 'error');
		} finally {
			sending = '';
		}
	}
</script>

{#snippet serverRow(server: (typeof data.servers)[number], label: string)}
	<div class="bg-ash-900 border-ash-700 flex items-center gap-3 rounded-lg border p-3">
		<div class="bg-ash-800 border-ash-700 flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border">
			{#if server.server_icon}
				<img src={server.server_icon} alt={server.name} class="h-full w-full object-cover" loading="lazy" />
			{:else}
				<i class="fas fa-server text-ash-500 text-xs"></i>
			{/if}
		</div>
		<div class="min-w-0 flex-1">
			<div class="text-ash-100 truncate text-sm font-medium">{server.name}</div>
			<div class="text-ash-500 truncate text-xs">{server.bots.join(', ')} · {isGreeted(server) ? 'greeted' : 'not greeted yet'}</div>
		</div>
		<button
			onclick={() => send(server.discord_server_id)}
			disabled={sending === server.discord_server_id}
			class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all disabled:opacity-50"
		>
			{#if sending === server.discord_server_id}
				<i class="fas fa-spinner fa-spin"></i>
			{:else}
				<i class="fas fa-paper-plane"></i>
			{/if}
			{label}
		</button>
	</div>
{/snippet}

<svelte:head>
	<title>Greetings | {APP_NAME} Discord Bot</title>
</svelte:head>

<div class="mb-4">
	<h2 class="text-ash-100 mb-1 text-xl font-bold sm:text-2xl">
		<i class="fas fa-hands-clapping mr-2 text-amber-400"></i>Greetings
	</h2>
	<p class="text-ash-400 text-xs sm:text-sm">Sent automatically when a bot joins. Only the first bot greets a shared server.</p>
</div>

{#if data.servers.length === 0}
	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<p class="text-ash-400 py-6 text-center text-sm">No servers yet. Add a bot to a Discord server first.</p>
	</div>
{:else}
	<div class="bg-ash-800 border-ash-700 mb-5 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-1 flex items-center gap-2 text-base font-semibold">
			<i class="fas fa-circle-exclamation text-amber-400"></i>Not greeted yet
			<span class="text-ash-500 text-xs font-normal">({pending.length})</span>
		</h3>
		<p class="text-ash-400 mb-4 text-xs">No bot has greeted these yet.</p>

		{#if pending.length === 0}
			<p class="text-ash-400 py-4 text-center text-sm">Every server has been greeted.</p>
		{:else}
			<div class="space-y-2">
				{#each pending as server (server.discord_server_id)}
					{@render serverRow(server, 'Send greeting')}
				{/each}
			</div>
		{/if}
	</div>

	<div class="bg-ash-800 border-ash-700 rounded-xl border p-4 sm:p-6">
		<h3 class="text-ash-100 mb-1 flex items-center gap-2 text-base font-semibold">
			<i class="fas fa-list text-sky-400"></i>All servers
			<span class="text-ash-500 text-xs font-normal">({data.servers.length})</span>
		</h3>
		<p class="text-ash-400 mb-4 text-xs">Search any server, greeted or not, and resend its greeting.</p>

		<div class="mb-4">
			<div class="bg-ash-900 border-ash-600 flex items-center gap-2 rounded-lg border px-3 py-2">
				<i class="fas fa-magnifying-glass text-ash-500 text-xs"></i>
				<input
					type="text"
					bind:value={search}
					placeholder="Search name or server ID"
					class="text-ash-100 placeholder:text-ash-500 w-full bg-transparent text-sm focus:outline-none"
				/>
			</div>
		</div>

		<div class="space-y-2">
			{#each matches as server (server.discord_server_id)}
				{@render serverRow(server, 'Resend')}
			{/each}
			{#if matches.length === 0}
				<p class="text-ash-400 py-6 text-center text-sm">No servers match that search.</p>
			{/if}
		</div>
	</div>
{/if}
