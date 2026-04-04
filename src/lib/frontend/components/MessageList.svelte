<script lang="ts">
	interface Props {
		label: string;
		values: string[];
		placeholder?: string;
		placeholders?: { code: string; desc: string }[];
		/** Tailwind text-* class for list header / modal icons (match parent config page accent). */
		iconAccent?: string;
		iconAccentMuted?: string;
		onchange: (values: string[]) => void;
	}
	let {
		label,
		values,
		placeholder = 'Enter message...',
		placeholders,
		iconAccent = 'text-cyan-300',
		iconAccentMuted = 'text-cyan-300/80',
		onchange
	}: Props = $props();

	let modalOpen = $state(false);
	let editIndex = $state<number | null>(null);
	let draftText = $state('');

	function openAdd() {
		editIndex = null;
		draftText = '';
		modalOpen = true;
	}

	function openEdit(i: number) {
		editIndex = i;
		draftText = values[i];
		modalOpen = true;
	}

	function saveModal() {
		if (!draftText.trim()) return;
		if (editIndex !== null) {
			const next = [...values];
			next[editIndex] = draftText;
			onchange(next);
		} else {
			onchange([...values, draftText]);
		}
		modalOpen = false;
	}

	function remove(i: number) {
		onchange(values.filter((_, idx) => idx !== i));
	}
</script>

<div>
	<div class="mb-2 flex items-center justify-between">
		<label class="text-ash-300 text-xs font-medium"><i class="fas fa-comment-dots mr-1.5 {iconAccent}"></i>{label}</label>
		<button
			type="button"
			onclick={openAdd}
			class="bg-ash-600 hover:bg-ash-500 text-ash-100 flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs transition-colors"
		>
			<i class="fas fa-plus text-xs {iconAccent}"></i>Add Message
		</button>
	</div>

	{#if values.length === 0}
		<div class="bg-ash-700 rounded-lg p-4 text-center">
			<i class="fas fa-inbox mb-2 text-2xl {iconAccentMuted}"></i>
			<p class="text-ash-400 text-xs">No messages configured. Click Add Message to create one.</p>
		</div>
	{:else}
		<div class="space-y-2">
			{#each values as msg, i}
				<div class="bg-ash-700 flex items-start justify-between gap-3 rounded-lg p-3">
					<p class="text-ash-100 min-w-0 flex-1 text-sm break-words">{msg}</p>
					<div class="flex shrink-0 items-center gap-1.5">
						<button type="button" onclick={() => openEdit(i)} class="bg-ash-600 hover:bg-ash-500 rounded-lg p-1.5 text-xs text-white transition-colors">
							<i class="fas fa-edit"></i>
						</button>
						<button type="button" onclick={() => remove(i)} class="rounded-lg bg-red-900 p-1.5 text-xs text-red-300 transition-colors hover:bg-red-800">
							<i class="fas fa-trash"></i>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if modalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="bg-ash-800 border-ash-700 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-5">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-ash-100 flex items-center gap-2 font-bold">
					<i class="fas fa-comment-dots {iconAccent}"></i>
					{editIndex !== null ? 'Edit Message' : 'Add Message'}
				</h3>
				<button onclick={() => (modalOpen = false)} aria-label="Close" class="text-ash-400 hover:text-ash-100 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="mb-3 flex-1">
				<label class="text-ash-300 mb-1.5 block text-xs font-medium">Message</label>
				<textarea
					bind:value={draftText}
					rows={6}
					{placeholder}
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full resize-none rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
				></textarea>
			</div>

			{#if placeholders && placeholders.length > 0}
				<div class="bg-ash-900 border-ash-600 mb-4 rounded-lg border p-3">
					<p class="text-ash-200 mb-2 text-xs font-medium">Available placeholders:</p>
					<div class="grid grid-cols-2 gap-2 text-xs">
						{#each placeholders as p}
							<div class="text-ash-300 flex items-center gap-2">
								<code class="bg-ash-800 text-ash-200 rounded px-1.5 py-0.5">{'{' + p.code + '}'}</code>
								<span>{p.desc}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="border-ash-700 flex gap-2 border-t pt-3">
				<button
					type="button"
					onclick={() => (modalOpen = false)}
					class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={saveModal}
					disabled={!draftText.trim()}
					class="bg-ash-500 hover:bg-ash-400 text-ash-100 flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
				>
					<i class="fas fa-check text-emerald-300"></i>Save Message
				</button>
			</div>
		</div>
	</div>
{/if}
