<script lang="ts">
	interface Member {
		id: number;
		discord_member_id: string;
		username: string | null;
		display_name: string | null;
		server_display_name: string | null;
		avatar: string | null;
	}

	interface Props {
		serverId: number;
		/** Selected discord_member_id (or '' for none) */
		value: string;
		disabled?: boolean;
		placeholder?: string;
		onchange: (discord_member_id: string) => void;
	}

	let { serverId, value, disabled = false, placeholder = 'Select member...', onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let loading = $state(false);
	let results = $state<Member[]>([]);

	const selectedLabel = $derived(value ? value : '');

	let timer: any = null;
	function scheduleSearch() {
		if (timer) clearTimeout(timer);
		timer = setTimeout(() => void runSearch(), 250);
	}

	async function runSearch() {
		const q = search.trim();
		if (q.length < 2) {
			results = [];
			return;
		}
		loading = true;
		try {
			const res = await fetch(`/api/servers/${serverId}/members?q=${encodeURIComponent(q)}&limit=25`, { credentials: 'include' });
			const d = await res.json();
			results = d?.success ? (d.members as Member[]) : [];
		} catch {
			results = [];
		} finally {
			loading = false;
		}
	}

	function pick(id: string) {
		onchange(id);
		open = false;
		search = '';
		results = [];
	}

	function close() {
		open = false;
		search = '';
		results = [];
	}

	function label(m: Member) {
		return m.server_display_name || m.display_name || m.username || m.discord_member_id;
	}
</script>

<button
	type="button"
	{disabled}
	onclick={() => (open = true)}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
>
	<span class={value ? 'text-ash-100' : 'text-ash-300'}>
		{value ? selectedLabel : placeholder}
	</span>
	<i class="fas fa-chevron-down text-ash-400 text-xs"></i>
</button>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-users text-ash-200"></i>Select Member
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					oninput={() => scheduleSearch()}
					placeholder="Search members..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				{#if loading}
					<i class="fas fa-spinner fa-spin text-ash-400 absolute top-1/2 right-3 -translate-y-1/2"></i>
				{:else}
					<i class="fas fa-search text-ash-400 absolute top-1/2 right-3 -translate-y-1/2"></i>
				{/if}
			</div>

			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				<button
					type="button"
					onclick={() => pick('')}
					class="text-ash-400 hover:bg-ash-700 w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors {value === '' ? 'bg-ash-700' : ''}"
				>
					— None —
				</button>

				{#if results.length === 0}
					<p class="text-ash-500 py-4 text-center text-sm">Type at least 2 characters to search</p>
				{:else}
					{#each results as m (m.discord_member_id)}
						<button
							type="button"
							onclick={() => pick(m.discord_member_id)}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
								{value === m.discord_member_id ? 'bg-ash-900 border-ash-500 border' : 'bg-ash-700 hover:bg-ash-600'}"
						>
							<div class="flex min-w-0 flex-1 items-center gap-3">
								{#if m.avatar}
									<img src={m.avatar} alt="" class="h-7 w-7 shrink-0 rounded-full" />
								{:else}
									<div class="bg-ash-600 h-7 w-7 shrink-0 rounded-full"></div>
								{/if}
								<div class="min-w-0 flex-1">
									<p class="text-ash-100 truncate text-sm font-medium">{label(m)}</p>
									<p class="text-ash-400 truncate text-xs">{m.discord_member_id}</p>
								</div>
							</div>
							{#if value === m.discord_member_id}
								<i class="fas fa-check text-ash-200 text-sm"></i>
							{:else}
								<i class="fas fa-chevron-right text-ash-500 text-xs"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
