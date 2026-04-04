<script lang="ts">
	import { NUMERIC_SELECT_ACCENT } from '$lib/frontend/controlAccents.js';

	type Props = {
		label: string;
		description?: string;
		labelIconClass?: string;
		values: number[];
		value?: number;
		formatOption?: (v: number) => string;
		id?: string;
		disabled?: boolean;
	};

	let {
		label,
		description = '',
		labelIconClass,
		values,
		value = $bindable(0),
		formatOption = (v: number) => String(v),
		id,
		disabled = false
	}: Props = $props();

	let open = $state(false);
	let search = $state('');

	const displayLabel = $derived(formatOption(value ?? 0));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return values;
		return values.filter((v) => formatOption(v).toLowerCase().includes(q));
	});

	const titleId = $derived(id ? `${id}-number-picker-title` : undefined);

	function openModal() {
		if (disabled || values.length === 0) return;
		search = '';
		open = true;
	}

	function close() {
		open = false;
		search = '';
	}

	function pick(v: number) {
		value = v;
		close();
	}

	$effect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') close();
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	$effect(() => {
		if (disabled) open = false;
	});
</script>

<div>
	<label for={id} class="text-ash-300 mb-1.5 block text-xs font-medium">
		{#if labelIconClass}
			<i class={labelIconClass}></i>
		{/if}
		{label}
	</label>
	{#if description}
		<p class="text-ash-500 mb-2 text-xs">{description}</p>
	{/if}
	<button
		type="button"
		{id}
		disabled={disabled || values.length === 0}
		onclick={openModal}
		class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
		aria-haspopup="dialog"
		aria-expanded={open}
	>
		<span class="text-ash-100 min-w-0 truncate">{displayLabel}</span>
		<i class={NUMERIC_SELECT_ACCENT.chevron}></i>
	</button>
</div>

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label={titleId ? undefined : label}
			aria-labelledby={titleId}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 id={titleId} class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-list-ol text-cyan-400"></i>
					{label}
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<div class="relative mb-4">
				<input
					type="text"
					bind:value={search}
					placeholder="Search…"
					class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-4 py-2.5 pr-10 text-sm transition-all focus:ring-2 focus:outline-none sm:py-3 sm:text-base"
				/>
				<i class="fas fa-search absolute top-1/2 right-3 -translate-y-1/2 text-cyan-300/90"></i>
			</div>

			<div class="max-h-[min(50vh,24rem)] min-h-0 space-y-1 overflow-y-auto">
				{#if filtered.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox mb-2 text-3xl text-cyan-300/80"></i>
						<p>No matching options</p>
					</div>
				{:else}
					{#each filtered as val (val)}
						{@const selected = value === val}
						<button
							type="button"
							onclick={() => pick(val)}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors {selected
								? 'bg-ash-900 border-ash-500 border'
								: 'bg-ash-700 hover:bg-ash-600'}"
						>
							<span class="{selected ? 'text-ash-100' : 'text-ash-300'} font-medium">{formatOption(val)}</span>
							{#if selected}
								<i class="fas fa-check text-sm text-emerald-300"></i>
							{:else}
								<i class="fas fa-check text-sm text-transparent"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
