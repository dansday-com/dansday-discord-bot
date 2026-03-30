<script lang="ts">
	interface Props {
		label: string;
		values: string[];
		placeholder?: string;
		onchange: (values: string[]) => void;
	}
	let { label, values, placeholder = 'Enter message...', onchange }: Props = $props();

	function update(i: number, val: string) {
		const next = [...values];
		next[i] = val;
		onchange(next);
	}

	function add() { onchange([...values, '']); }
	function remove(i: number) { onchange(values.filter((_, idx) => idx !== i)); }
</script>

<div>
	<div class="flex items-center justify-between mb-2">
		<label class="text-xs font-medium text-ash-300">{label}</label>
		<button
			type="button"
			onclick={add}
			class="text-xs px-2 py-1 rounded bg-ash-700 hover:bg-ash-600 text-ash-200 transition-colors flex items-center gap-1"
		>
			<i class="fas fa-plus text-xs"></i>Add
		</button>
	</div>
	{#if values.length === 0}
		<p class="text-xs text-ash-500 italic">No messages yet. Click Add to create one.</p>
	{:else}
		<div class="space-y-2">
			{#each values as msg, i}
				<div class="flex gap-2">
					<textarea
						value={msg}
						oninput={(e) => update(i, (e.target as HTMLTextAreaElement).value)}
						rows={2}
						{placeholder}
						class="flex-1 px-3 py-2 bg-ash-700 border border-ash-600 rounded-lg text-ash-100 placeholder-ash-500 text-sm focus:outline-none focus:ring-2 focus:ring-ash-500 resize-none"
					></textarea>
					<button
						type="button"
						onclick={() => remove(i)}
						class="px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-300 text-xs self-start mt-1 transition-colors"
					>
						<i class="fas fa-trash"></i>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
