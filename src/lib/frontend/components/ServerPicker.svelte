<script lang="ts">
	import { SERVER_PICKER_ACCENT } from '$lib/frontend/controlAccents.js';

	interface Server {
		discord_server_id: string;
		name?: string | null;
		server_icon?: string | null;
	}

	interface Props {
		servers: Server[];
		value: string;
		placeholder?: string;
		emptyText?: string;
		onchange: (value: string) => void;
	}

	let { servers, value, placeholder = 'Select server...', emptyText = 'No servers found', onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');

	const selected = $derived(servers.find((s) => String(s.discord_server_id) === String(value)));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return servers;
		return servers.filter((s) => s.name?.toLowerCase().includes(q) || String(s.discord_server_id).includes(q));
	});

	function serverName(server: Server) {
		return server.name || `Server ${server.discord_server_id}`;
	}

	function openModal() {
		open = true;
		search = '';
	}

	function close() {
		open = false;
		search = '';
	}

	function select(id: string) {
		onchange(id);
		close();
	}
</script>

<button
	type="button"
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	{#if selected}
		<span class="text-ash-100 flex min-w-0 items-center gap-2">
			<span class="bg-ash-600 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-full">
				{#if selected.server_icon}
					<img src={selected.server_icon} alt="" class="h-full w-full object-cover" />
				{:else}
					<i class="fas fa-server text-[9px] text-teal-300"></i>
				{/if}
			</span>
			<span class="truncate">{serverName(selected)}</span>
		</span>
	{:else}
		<span class="text-ash-300">{placeholder}</span>
	{/if}
	<i class="{SERVER_PICKER_ACCENT.chevron} ml-2 shrink-0"></i>
</button>

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class={SERVER_PICKER_ACCENT.modalTitleIcon}></i>
					Select Server
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search servers..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="{SERVER_PICKER_ACCENT.searchIcon} absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>

			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				{#if servers.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox {SERVER_PICKER_ACCENT.emptyStateIcon}"></i>
						<p>{emptyText}</p>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => select('')}
						class="text-ash-400 hover:bg-ash-700 w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors {value === '' ? 'bg-ash-700' : ''}"
					>
						— None —
					</button>

					{#each filtered as server}
						{@const isSelected = String(server.discord_server_id) === String(value)}
						<button
							type="button"
							onclick={() => select(String(server.discord_server_id))}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
								{isSelected ? 'bg-ash-900 border-ash-500 border' : 'bg-ash-700 hover:bg-ash-600'}"
						>
							<div class="flex min-w-0 flex-1 items-center gap-3">
								<span class="bg-ash-600 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
									{#if server.server_icon}
										<img src={server.server_icon} alt="" class="h-full w-full object-cover" />
									{:else}
										<i class="fas fa-server text-xs text-teal-300"></i>
									{/if}
								</span>
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm font-medium">{serverName(server)}</p>
									<p class="text-ash-400 text-xs">{server.discord_server_id}</p>
								</div>
							</div>
							{#if isSelected}
								<i class="fas fa-check text-sm text-emerald-300"></i>
							{:else}
								<i class="fas fa-chevron-right text-xs {SERVER_PICKER_ACCENT.listChevron}"></i>
							{/if}
						</button>
					{/each}

					{#if filtered.length === 0}
						<p class="text-ash-500 py-4 text-center text-sm">No servers match your search</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
