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
	const selected = $derived(channels.find((c) => c.id === value));
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors"
	>
		<span class={selected ? 'text-ash-100' : 'text-ash-500'}>
			{selected ? `#${selected.name}` : placeholder}
		</span>
		<i class="fas fa-chevron-{open ? 'up' : 'down'} text-ash-500 text-xs"></i>
	</button>
	{#if open}
		<div class="bg-ash-700 border-ash-600 absolute z-10 mt-1 max-h-48 w-full overflow-hidden overflow-y-auto rounded-lg border shadow-lg">
			<button
				type="button"
				onclick={() => {
					onchange('');
					open = false;
				}}
				class="text-ash-500 hover:bg-ash-600 w-full px-3 py-2 text-left text-sm transition-colors"
			>
				— None —
			</button>
			{#each channels as ch}
				<button
					type="button"
					onclick={() => {
						onchange(ch.id);
						open = false;
					}}
					class="hover:bg-ash-600 flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors
						{value === ch.id ? 'text-ash-100 bg-ash-600' : 'text-ash-300'}"
				>
					<span class="text-ash-500">#</span>{ch.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
