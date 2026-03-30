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

	function add() {
		onchange([...values, '']);
	}
	function remove(i: number) {
		onchange(values.filter((_, idx) => idx !== i));
	}
</script>

<div>
	<div class="mb-2 flex items-center justify-between">
		<label class="text-ash-300 text-xs font-medium">{label}</label>
		<button type="button" onclick={add} class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors">
			<i class="fas fa-plus text-xs"></i>Add
		</button>
	</div>
	{#if values.length === 0}
		<p class="text-ash-500 text-xs italic">No messages yet. Click Add to create one.</p>
	{:else}
		<div class="space-y-2">
			{#each values as msg, i}
				<div class="flex gap-2">
					<textarea
						value={msg}
						oninput={(e) => update(i, (e.target as HTMLTextAreaElement).value)}
						rows={2}
						{placeholder}
						class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
					></textarea>
					<button
						type="button"
						onclick={() => remove(i)}
						class="mt-1 self-start rounded bg-red-900 px-2 py-1 text-xs text-red-300 transition-colors hover:bg-red-800"
					>
						<i class="fas fa-trash"></i>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>
