<script lang="ts">
	import { LABELED_SELECT_ACCENT } from '$lib/frontend/controlAccents.js';
	import type { LabeledSelectOption } from './labeledSelect.js';

	type Appearance = 'dashboard' | 'members-toolbar' | 'form-inline';

	type LabelTone = 'neutral' | 'cyan';

	type Props = {
		options: LabeledSelectOption[];
		value?: string;
		label?: string;
		labelIconClass?: string;
		labelTone?: LabelTone;
		appearance?: Appearance;
		selectClass?: string;
		id?: string;
		disabled?: boolean;
		ariaLabel?: string;
	};

	let {
		options,
		value = $bindable(''),
		label = '',
		labelIconClass,
		labelTone = 'neutral',
		appearance = 'members-toolbar',
		selectClass = '',
		id,
		disabled = false,
		ariaLabel
	}: Props = $props();

	const labelTextClass = $derived(labelTone === 'cyan' ? LABELED_SELECT_ACCENT.label : 'text-ash-400');

	const rowClass: Record<Appearance, string> = {
		dashboard:
			'bg-ash-800 border-ash-600 hover:border-ash-500 flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border px-2 py-1.5 transition-colors sm:px-4 sm:py-2',
		'members-toolbar':
			'bg-ash-800 border-ash-700 hover:border-ash-600 flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors sm:min-w-[12rem]',
		'form-inline':
			'bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 transition-colors sm:w-36'
	};

	const selectTextClass: Record<Appearance, string> = {
		dashboard: 'text-xs sm:text-sm',
		'members-toolbar': 'text-sm',
		'form-inline': 'text-sm'
	};

	const mergedButtonText = $derived(`${selectTextClass[appearance]} ${selectClass}`.trim());

	let open = $state(false);
	let search = $state('');

	const displayLabel = $derived(options.find((o) => o.value === value)?.label ?? (value !== '' ? value : (options[0]?.label ?? 'Select…')));

	const filtered = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return options;
		return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
	});

	const modalHeading = $derived(label || ariaLabel || 'Select');

	const titleId = $derived(id ? `${id}-labeled-picker-title` : undefined);

	function openModal() {
		if (disabled || options.length === 0) return;
		search = '';
		open = true;
	}

	function close() {
		open = false;
		search = '';
	}

	function pick(opt: LabeledSelectOption) {
		value = opt.value;
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

{#if label}
	<div class="flex min-w-0 items-center gap-2 sm:gap-3">
		<label for={id} class="{labelTextClass} flex shrink-0 items-center gap-1 text-xs whitespace-nowrap sm:gap-2 sm:text-sm">
			{#if labelIconClass}
				<i class={labelIconClass}></i>
			{/if}
			<span class="sm:inline">{label}</span>
		</label>
		<div class="{rowClass[appearance]} {disabled || options.length === 0 ? 'opacity-50' : ''}">
			<button
				type="button"
				{id}
				disabled={disabled || options.length === 0}
				onclick={openModal}
				class="text-ash-100 min-w-0 flex-1 cursor-pointer truncate text-left focus:outline-none disabled:cursor-not-allowed {mergedButtonText}"
				aria-haspopup="dialog"
				aria-expanded={open}
				aria-label={ariaLabel ?? label}
			>
				{displayLabel}
			</button>
			<i class={LABELED_SELECT_ACCENT.chevron}></i>
		</div>
	</div>
{:else}
	<div class="w-full shrink-0 sm:w-auto {rowClass[appearance]} {disabled || options.length === 0 ? 'opacity-50' : ''}">
		<button
			type="button"
			{id}
			disabled={disabled || options.length === 0}
			onclick={openModal}
			class="text-ash-100 min-w-0 flex-1 cursor-pointer truncate text-left focus:outline-none disabled:cursor-not-allowed {mergedButtonText}"
			aria-haspopup="dialog"
			aria-expanded={open}
			aria-label={ariaLabel ?? 'Select'}
		>
			{displayLabel}
		</button>
		<i class={LABELED_SELECT_ACCENT.chevron}></i>
	</div>
{/if}

{#if open}
	<div class="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label={titleId ? undefined : modalHeading}
			aria-labelledby={titleId}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 id={titleId} class="text-ash-100 flex min-w-0 items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-list-ul shrink-0 text-emerald-400"></i>
					<span class="truncate">{modalHeading}</span>
				</h3>
				<button type="button" onclick={close} aria-label="Close" class="text-ash-400 hover:text-ash-100 shrink-0 p-1 transition-colors">
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
				<i class="fas fa-search absolute top-1/2 right-3 -translate-y-1/2 text-emerald-300/90"></i>
			</div>

			<div class="max-h-[min(50vh,24rem)] min-h-0 space-y-1 overflow-y-auto">
				{#if filtered.length === 0}
					<div class="text-ash-400 py-8 text-center text-sm">
						<i class="fas fa-inbox mb-2 text-3xl text-emerald-300/80"></i>
						<p>No matching options</p>
					</div>
				{:else}
					{#each filtered as opt (opt.value)}
						{@const selected = value === opt.value}
						<button
							type="button"
							onclick={() => pick(opt)}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors {selected
								? 'bg-ash-900 border-ash-500 border'
								: 'bg-ash-700 hover:bg-ash-600'}"
						>
							<span class="{selected ? 'text-ash-100' : 'text-ash-300'} font-medium">{opt.label}</span>
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
