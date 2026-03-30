<script lang="ts">
	interface Channel { id: string; name: string; }
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
		class="w-full px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-left text-sm hover:border-ash-500 transition-colors flex items-center justify-between"
	>
		<span class="{selected ? 'text-ash-100' : 'text-ash-500'}">
			{selected ? `#${selected.name}` : placeholder}
		</span>
		<i class="fas fa-chevron-{open ? 'up' : 'down'} text-ash-500 text-xs"></i>
	</button>
	{#if open}
		<div class="absolute z-10 mt-1 w-full bg-ash-700 border border-ash-600 rounded-lg overflow-hidden max-h-48 overflow-y-auto shadow-lg">
			<button
				type="button"
				onclick={() => { onchange(''); open = false; }}
				class="w-full px-3 py-2 text-left text-sm text-ash-500 hover:bg-ash-600 transition-colors"
			>
				— None —
			</button>
			{#each channels as ch}
				<button
					type="button"
					onclick={() => { onchange(ch.id); open = false; }}
					class="w-full px-3 py-2 text-left text-sm hover:bg-ash-600 transition-colors flex items-center gap-2
						{value === ch.id ? 'text-ash-100 bg-ash-600' : 'text-ash-300'}"
				>
					<span class="text-ash-500">#</span>{ch.name}
				</button>
			{/each}
		</div>
	{/if}
</div>
