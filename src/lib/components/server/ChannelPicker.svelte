<script lang="ts">
	interface Channel {
		id: string;
		name: string;
	}
	interface Props {
		channels: Channel[];
		value: string;
		placeholder?: string;
		onchange: (id: string) => void;
	}
	let { channels, value, placeholder = 'Select channel...', onchange }: Props = $props();
	let open = $state(false);
	let search = $state('');

	const selected = $derived(channels.find((c) => c.id === value));
	const filtered = $derived(search.trim() ? channels.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : channels);

	function pick(id: string) {
		onchange(id);
		open = false;
		search = '';
	}
</script>

<button
	type="button"
	onclick={() => (open = true)}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
>
	<span class={selected ? 'text-ash-100' : 'text-ash-300'}>
		{selected ? `#${selected.name}` : placeholder}
	</span>
	<i class="fas fa-chevron-down text-ash-400 text-xs"></i>
</button>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4"
		onclick={() => {
			open = false;
			search = '';
		}}
	>
		<div
			class="bg-ash-800 border-ash-700 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-hashtag text-ash-200"></i>Select Channel
				</h3>
				<button
					type="button"
					onclick={() => {
						open = false;
						search = '';
					}}
					class="text-ash-400 hover:text-ash-100 p-1 transition-colors"
				>
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>
			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search channels..."
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="fas fa-search text-ash-400 absolute top-1/2 right-3 -translate-y-1/2"></i>
			</div>
			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				<button type="button" onclick={() => pick('')} class="text-ash-400 hover:bg-ash-700 w-full rounded-lg px-3 py-2 text-left text-sm transition-colors">
					— None —
				</button>
				{#each filtered as ch}
					<button
						type="button"
						onclick={() => pick(ch.id)}
						class="hover:bg-ash-700 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors
							{value === ch.id ? 'bg-ash-700 text-ash-100' : 'text-ash-300'}"
					>
						<span class="text-ash-500">#</span>{ch.name}
						{#if value === ch.id}<i class="fas fa-check text-ash-300 ml-auto text-xs"></i>{/if}
					</button>
				{/each}
				{#if filtered.length === 0}
					<p class="text-ash-500 py-4 text-center text-sm">No channels found</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
