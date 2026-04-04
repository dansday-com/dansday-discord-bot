<script lang="ts">
	import { MEMBER_PICKER_ACCENT } from '$lib/frontend/controlAccents.js';

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
		value: string | string[];
		single?: boolean;
		/** When multi-select, show removable name chips under the trigger (default true). Set false for large lists / tight layouts. */
		showMultiChips?: boolean;
		disabled?: boolean;
		placeholder?: string;
		onchange: (value: string | string[]) => void;
	}

	let { serverId, value, single = true, showMultiChips = true, disabled = false, placeholder = 'Select member...', onchange }: Props = $props();

	let open = $state(false);
	let search = $state('');
	let loading = $state(false);
	let results = $state<Member[]>([]);
	let pending = $state<string[]>([]);
	let labelById = $state<Record<string, string>>({});

	const currentIds = $derived(single ? (value ? [value as string] : []) : ([...(value as string[])] as string[]));

	function label(m: Member) {
		return m.server_display_name || m.display_name || m.username || m.discord_member_id;
	}

	function rememberMember(m: Member) {
		const id = m.discord_member_id;
		const l = label(m);
		if (labelById[id] === l) return;
		labelById = { ...labelById, [id]: l };
	}

	const selectedLabelSingle = $derived(single ? (labelById[value as string] ?? (value as string) ?? '') : '');

	let timer: ReturnType<typeof setTimeout> | null = null;
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

	function openModal() {
		if (!single) {
			pending = [...currentIds];
		}
		open = true;
		search = '';
	}

	function pickSingle(m: Member | null) {
		if (!m) {
			onchange('');
			labelById = {};
		} else {
			const id = m.discord_member_id;
			labelById = { [id]: label(m) };
			onchange(id);
		}
		open = false;
		search = '';
		results = [];
	}

	function toggleMulti(m: Member) {
		rememberMember(m);
		const id = m.discord_member_id;
		if (pending.includes(id)) {
			pending = pending.filter((x) => x !== id);
		} else {
			pending = [...pending, id];
		}
	}

	function confirmMulti() {
		onchange([...pending]);
		open = false;
		search = '';
		results = [];
	}

	function close() {
		open = false;
		search = '';
		results = [];
	}

	function clearMultiSelection() {
		onchange([]);
		labelById = {};
	}

	function removeChip(id: string) {
		if (single) {
			onchange('');
			const { [id]: _, ...rest } = labelById;
			labelById = rest;
		} else {
			onchange((value as string[]).filter((x) => x !== id));
			const { [id]: _, ...rest } = labelById;
			labelById = rest;
		}
	}

	function isRowSelected(id: string) {
		return single ? (value as string) === id : pending.includes(id);
	}
</script>

<button
	type="button"
	{disabled}
	onclick={openModal}
	class="bg-ash-700 border-ash-600 hover:border-ash-500 flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60"
>
	{#if single}
		<span class={(value as string) ? 'text-ash-100' : 'text-ash-300'}>
			{(value as string) ? selectedLabelSingle : placeholder}
		</span>
	{:else}
		<span class={(value as string[]).length ? 'text-ash-100' : 'text-ash-300'}>
			{(value as string[]).length ? `${(value as string[]).length} member${(value as string[]).length !== 1 ? 's' : ''} selected` : placeholder}
		</span>
	{/if}
	<i class={MEMBER_PICKER_ACCENT.chevron}></i>
</button>

{#if !single && showMultiChips && (value as string[]).length > 0}
	<div class="mt-2 max-h-32 overflow-y-auto rounded-md">
		<div class="flex flex-wrap gap-1">
			{#each value as string[] as id (id)}
				<span class="border-ash-600 bg-ash-800 text-ash-200 flex max-w-full min-w-0 items-center gap-1 rounded border px-2 py-0.5 text-xs">
					<span class="truncate">{labelById[id] ?? id}</span>
					<button
						type="button"
						{disabled}
						onclick={() => removeChip(id)}
						class="text-ash-400 hover:text-ash-100 ml-0.5 shrink-0 disabled:opacity-40"
						aria-label="Remove"
					>
						<i class="fas fa-times text-xs"></i>
					</button>
				</span>
			{/each}
		</div>
	</div>
{/if}

{#if !single && !showMultiChips && (value as string[]).length > 0 && !disabled}
	<button type="button" onclick={clearMultiSelection} class="text-ash-500 hover:text-ash-300 decoration-ash-600 mt-1.5 text-xs underline underline-offset-2">
		Clear selection
	</button>
{/if}

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={close}>
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border p-4 shadow-2xl sm:p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="mb-4 flex items-center justify-between sm:mb-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class={MEMBER_PICKER_ACCENT.modalTitleIcon}></i>{single ? 'Select Member' : 'Select Members'}
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
					<i class="{MEMBER_PICKER_ACCENT.searchSpinner} absolute top-1/2 right-3 -translate-y-1/2"></i>
				{:else}
					<i class="{MEMBER_PICKER_ACCENT.searchIcon} absolute top-1/2 right-3 -translate-y-1/2"></i>
				{/if}
			</div>

			<div class="min-h-0 flex-1 space-y-1 overflow-y-auto">
				{#if single}
					<button
						type="button"
						onclick={() => pickSingle(null)}
						class="text-ash-400 hover:bg-ash-700 w-full rounded-lg px-4 py-2.5 text-left text-sm transition-colors {!value ? 'bg-ash-700' : ''}"
					>
						— None —
					</button>
				{/if}

				{#if results.length === 0}
					<p class="text-ash-500 py-4 text-center text-sm">Type at least 2 characters to search</p>
				{:else}
					{#each results as m (m.discord_member_id)}
						<button
							type="button"
							onclick={() => (single ? pickSingle(m) : toggleMulti(m))}
							class="flex w-full items-center justify-between rounded-lg px-4 py-2.5 text-left text-sm transition-colors
								{isRowSelected(m.discord_member_id) ? 'bg-ash-900 border-ash-500 border' : 'bg-ash-700 hover:bg-ash-600'}"
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
							{#if isRowSelected(m.discord_member_id)}
								<i class="fas fa-check text-sm text-emerald-300"></i>
							{:else if single}
								<i class="fas fa-chevron-right text-xs {MEMBER_PICKER_ACCENT.listChevron}"></i>
							{:else}
								<i class="fas fa-check text-sm text-transparent"></i>
							{/if}
						</button>
					{/each}
				{/if}
			</div>

			{#if !single}
				<div class="border-ash-700 mt-4 border-t pt-4">
					<button
						type="button"
						onclick={confirmMulti}
						class="bg-ash-400 hover:bg-ash-500 text-ash-100 flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all sm:py-3 sm:text-base"
					>
						<i class="fas fa-check text-emerald-300"></i>Confirm Selection
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
