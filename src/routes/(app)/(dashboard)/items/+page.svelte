<script lang="ts">
	import { onMount } from 'svelte';
	import { showToast } from '$lib/frontend/toast.svelte';
	import LabeledSelect from '$lib/frontend/components/LabeledSelect.svelte';
	import ConfigToggleRow from '$lib/frontend/components/ConfigToggleRow.svelte';
	import ConfirmModal from '$lib/frontend/components/ConfirmModal.svelte';
	import type { LabeledSelectOption } from '$lib/frontend/components/labeledSelect.js';
	import { ITEM_EFFECTS, effectLabel, effectIcon, isTargetedEffect } from '$lib/items.js';

	const effectOptions: LabeledSelectOption[] = ITEM_EFFECTS.map((e) => ({ value: e.id, label: e.label }));

	let items = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);

	let editing = $state<any | null>(null);
	let confirmDelete = $state<any | null>(null);
	let deleting = $state(false);

	function blankForm() {
		return {
			id: null as number | null,
			name: '',
			effect_type: 'boost',
			description: '',
			cost: 100,
			enabled: true,
			available_from: '',
			available_to: '',
			cfg: {
				min_percent: 1,
				max_percent: 25,
				cooldown_minutes: 30,
				immunity_minutes: 30,
				multiplier: 2,
				skim_percent: 10,
				effect_duration_minutes: 60,
				scope: 'all',
				win_chance: 50,
				payout_multiplier: 2,
				gift_amount: 500,
				tax_percent: 10,
				bounty_amount: 500,
				recur_days: [] as number[],
				recur_from: '',
				recur_to: ''
			}
		};
	}

	let form = $state(blankForm());

	async function loadItems() {
		loading = true;
		try {
			const res = await fetch('/api/admin/items', { credentials: 'include' });
			const d = await res.json();
			if (d.success) items = d.items ?? [];
			else showToast(d.error || 'Failed to load', 'error');
		} finally {
			loading = false;
		}
	}

	onMount(loadItems);

	function buildConfig() {
		const c = form.cfg;
		const t = form.effect_type;
		const config: Record<string, any> = {};
		if (t === 'steal' || t === 'bomb') {
			config.min_percent = Number(c.min_percent);
			config.max_percent = Number(c.max_percent);
			config.cooldown_minutes = Number(c.cooldown_minutes);
			config.immunity_minutes = Number(c.immunity_minutes);
		} else if (t === 'boost') {
			config.multiplier = Number(c.multiplier);
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
			config.scope = c.scope;
		} else if (t === 'shield' || t === 'reflect' || t === 'insurance') {
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
		} else if (t === 'gift') {
			config.gift_amount = Number(c.gift_amount);
			config.tax_percent = Number(c.tax_percent);
		} else if (t === 'leech') {
			config.skim_percent = Number(c.skim_percent);
			config.effect_duration_minutes = Number(c.effect_duration_minutes);
		} else if (t === 'gamble') {
			config.win_chance = Number(c.win_chance);
			config.payout_multiplier = Number(c.payout_multiplier);
		} else if (t === 'bounty') {
			config.bounty_amount = Number(c.bounty_amount);
		}
		if (Array.isArray(c.recur_days) && c.recur_days.length > 0) {
			config.recurring_schedule = { days: c.recur_days.map(Number), from: c.recur_from, to: c.recur_to };
		}
		return config;
	}

	function startCreate() {
		form = blankForm();
		editing = { mode: 'create' };
	}

	function startEdit(item: any) {
		const cfg = typeof item.config === 'string' ? JSON.parse(item.config || '{}') : item.config || {};
		const f = blankForm();
		f.id = item.id;
		f.name = item.name ?? '';
		f.effect_type = item.effect_type ?? 'boost';
		f.description = item.description ?? '';
		f.cost = item.cost ?? 0;
		f.enabled = item.enabled !== false;
		f.available_from = item.available_from ? String(item.available_from).slice(0, 16).replace(' ', 'T') : '';
		f.available_to = item.available_to ? String(item.available_to).slice(0, 16).replace(' ', 'T') : '';
		f.cfg = { ...f.cfg, ...cfg };
		const recur = typeof item.recurring_schedule === 'string' ? JSON.parse(item.recurring_schedule || 'null') : item.recurring_schedule;
		if (recur) {
			f.cfg.recur_days = (recur.days ?? []).map(Number);
			f.cfg.recur_from = recur.from ?? '';
			f.cfg.recur_to = recur.to ?? '';
		}
		form = f;
		editing = { mode: 'edit' };
	}

	async function save() {
		saving = true;
		try {
			const config = buildConfig();
			const recurringSchedule = config.recurring_schedule ?? null;
			delete config.recurring_schedule;
			const payload: any = {
				name: form.name,
				effect_type: form.effect_type,
				description: form.description,
				cost: Number(form.cost),
				enabled: form.enabled,
				available_from: form.available_from ? form.available_from.replace('T', ' ') + ':00' : null,
				available_to: form.available_to ? form.available_to.replace('T', ' ') + ':00' : null,
				recurring_schedule: recurringSchedule,
				config
			};
			let res;
			if (form.id) {
				payload.id = form.id;
				res = await fetch('/api/admin/items', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(payload)
				});
			} else {
				res = await fetch('/api/admin/items', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify(payload)
				});
			}
			const d = await res.json();
			if (d.success) {
				showToast('Saved', 'success');
				editing = null;
				await loadItems();
			} else showToast(d.error || 'Failed to save', 'error');
		} finally {
			saving = false;
		}
	}

	async function remove() {
		const item = confirmDelete;
		if (!item) return;
		deleting = true;
		try {
			const res = await fetch('/api/admin/items', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ id: item.id })
			});
			const d = await res.json();
			if (d.success) {
				showToast('Deleted', 'success');
				confirmDelete = null;
				await loadItems();
			} else showToast(d.error || 'Failed to delete', 'error');
		} finally {
			deleting = false;
		}
	}

	const DAYS = [
		{ v: 0, l: 'Sun' },
		{ v: 1, l: 'Mon' },
		{ v: 2, l: 'Tue' },
		{ v: 3, l: 'Wed' },
		{ v: 4, l: 'Thu' },
		{ v: 5, l: 'Fri' },
		{ v: 6, l: 'Sat' }
	];

	function toggleDay(v: number) {
		const set = new Set(form.cfg.recur_days);
		if (set.has(v)) set.delete(v);
		else set.add(v);
		form.cfg.recur_days = [...set].sort((a, b) => a - b);
	}

	const isTargeted = $derived(isTargetedEffect(form.effect_type));

	$effect(() => {
		if (!editing) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') editing = null;
		};
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});
</script>

<div class="space-y-5">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-ash-100 flex items-center gap-2 text-lg font-semibold"><i class="fas fa-store text-teal-400"></i>Items</h2>
			<p class="text-ash-400 text-xs">Global catalog. Items appear in every server with the items module enabled.</p>
		</div>
		<button onclick={startCreate} class="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500">
			<i class="fas fa-plus"></i>Add Item
		</button>
	</div>

	{#if loading}
		<p class="text-ash-400 text-sm"><i class="fas fa-spinner fa-spin mr-1"></i>Loading...</p>
	{:else if items.length === 0}
		<div class="bg-ash-800 border-ash-700 rounded-xl border p-8 text-center">
			<p class="text-ash-400 text-sm">No items yet. Click "Add Item" to create your first one.</p>
		</div>
	{:else}
		<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
			{#each items as item}
				<div class="bg-ash-800 border-ash-700 rounded-xl border p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="text-ash-100 flex items-center gap-2 text-sm font-semibold">
								<i class="fas {effectIcon(item.effect_type)} text-ash-400"></i>
								<span class="truncate">{item.name}</span>
							</div>
							<div class="text-ash-500 mt-1 flex flex-wrap gap-1 text-[10px]">
								<span class="bg-ash-700 rounded px-1.5 py-0.5">{effectLabel(item.effect_type)}</span>
								{#if item.enabled === false}<span class="rounded bg-red-900/50 px-1.5 py-0.5 text-red-300">disabled</span>{/if}
							</div>
						</div>
						<div class="shrink-0 text-sm font-semibold text-teal-400">{item.cost} XP</div>
					</div>
					{#if item.description}<p class="text-ash-400 mt-2 line-clamp-2 text-xs">{item.description}</p>{/if}
					<div class="mt-3 flex gap-2">
						<button onclick={() => startEdit(item)} class="bg-ash-700 hover:bg-ash-600 text-ash-200 flex-1 rounded-lg py-1.5 text-xs">Edit</button>
						<button onclick={() => (confirmDelete = item)} class="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-900/60">Delete</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if editing}
	<div class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" onclick={() => (editing = null)} role="presentation">
		<div
			class="bg-ash-800 border-ash-700 my-4 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border shadow-2xl"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			aria-label={form.id ? 'Edit item' : 'Add item'}
		>
			<!-- Header -->
			<div class="border-ash-700 flex items-center justify-between border-b px-4 py-4 sm:px-6">
				<h3 class="text-ash-100 flex items-center gap-2 text-lg font-bold sm:text-xl">
					<i class="fas fa-store text-teal-400"></i>{form.id ? 'Edit Item' : 'Add Item'}
				</h3>
				<button type="button" onclick={() => (editing = null)} aria-label="Close" class="text-ash-400 hover:text-ash-100 p-1 transition-colors">
					<i class="fas fa-times text-lg"></i>
				</button>
			</div>

			<!-- Body -->
			<div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
				<!-- Basics -->
				<div class="space-y-4">
					<div>
						<label for="item-name" class="text-ash-300 mb-1.5 block text-xs font-medium">Name</label>
						<input
							id="item-name"
							bind:value={form.name}
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							placeholder="Mega Bomb"
						/>
					</div>

					<div>
						<span class="text-ash-300 mb-1.5 block text-xs font-medium">Effect type</span>
						<LabeledSelect id="item-effect" appearance="form-inline" selectClass="w-full" options={effectOptions} bind:value={form.effect_type} />
					</div>

					<div>
						<label for="item-desc" class="text-ash-300 mb-1.5 block text-xs font-medium">Description</label>
						<textarea
							id="item-desc"
							bind:value={form.description}
							rows="2"
							class="bg-ash-700 border-ash-600 text-ash-100 placeholder-ash-500 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
							placeholder="Shown on the item hover card"
						></textarea>
					</div>

					<div>
						<label for="item-cost" class="text-ash-300 mb-1.5 block text-xs font-medium">Cost (XP)</label>
						<input
							id="item-cost"
							type="number"
							bind:value={form.cost}
							class="bg-ash-700 border-ash-600 text-ash-100 focus:ring-ash-500 w-full rounded-lg border px-3 py-2.5 text-sm focus:ring-2 focus:outline-none"
						/>
					</div>
				</div>

				<!-- Effect settings -->
				<div class="border-ash-700 bg-ash-900/40 space-y-3 rounded-xl border p-4">
					<p class="text-ash-400 text-[11px] font-semibold tracking-wide uppercase">Effect settings</p>
					{#if form.effect_type === 'steal' || form.effect_type === 'bomb'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Min %<input
									type="number"
									bind:value={form.cfg.min_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Max %<input
									type="number"
									bind:value={form.cfg.max_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Cooldown (min)<input
									type="number"
									bind:value={form.cfg.cooldown_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Victim immunity (min)<input
									type="number"
									bind:value={form.cfg.immunity_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">
							{form.effect_type === 'steal' ? 'Random % of target total XP, transferred to buyer.' : 'Random % of target total XP, destroyed (vanishes).'}
						</p>
					{:else if form.effect_type === 'boost'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Multiplier<input
									type="number"
									step="0.1"
									bind:value={form.cfg.multiplier}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 col-span-2 text-xs"
								>Scope
								<select bind:value={form.cfg.scope} class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm">
									<option value="all">All XP</option>
									<option value="message">Message only</option>
									<option value="voice">Voice only</option>
								</select>
							</label>
						</div>
					{:else if form.effect_type === 'shield' || form.effect_type === 'reflect' || form.effect_type === 'insurance'}
						<label class="text-ash-300 text-xs"
							>Duration (min)<input
								type="number"
								bind:value={form.cfg.effect_duration_minutes}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">
							{#if form.effect_type === 'reflect'}While active, the next steal/bomb against you fails and hits the attacker instead.{:else if form.effect_type === 'insurance'}While
								active, the next time you're robbed your XP is refunded once.{:else}Blocks incoming steal/bomb while active.{/if}
						</p>
					{:else if form.effect_type === 'gift'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Gift amount (XP)<input
									type="number"
									bind:value={form.cfg.gift_amount}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Tax %<input
									type="number"
									bind:value={form.cfg.tax_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">Sends a fixed XP amount to a chosen member, minus the tax (burned).</p>
					{:else if form.effect_type === 'leech'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Skim %<input
									type="number"
									bind:value={form.cfg.skim_percent}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Duration (min)<input
									type="number"
									bind:value={form.cfg.effect_duration_minutes}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
					{:else if form.effect_type === 'gamble'}
						<div class="grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>Win chance %<input
									type="number"
									bind:value={form.cfg.win_chance}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>Payout multiplier<input
									type="number"
									step="0.1"
									bind:value={form.cfg.payout_multiplier}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
								/></label
							>
						</div>
						<p class="text-ash-500 text-[11px]">
							Members pick how much XP to wager (25/50/75/100%). On win they get the wager × multiplier; on loss they lose it. Not bought — played from the
							shop.
						</p>
					{:else if form.effect_type === 'bounty'}
						<label class="text-ash-300 text-xs"
							>Bounty amount (XP)<input
								type="number"
								bind:value={form.cfg.bounty_amount}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<p class="text-ash-500 text-[11px]">Puts XP on a member's head. Whoever lands the next successful steal on them collects it.</p>
					{:else}
						<p class="text-ash-500 text-[11px]">No extra settings for this effect type yet.</p>
					{/if}
				</div>

				<!-- Availability -->
				<div class="border-ash-700 bg-ash-900/40 space-y-3 rounded-xl border p-4">
					<p class="text-ash-400 text-[11px] font-semibold tracking-wide uppercase">Availability (optional, UTC)</p>
					<div class="grid grid-cols-2 gap-3">
						<label class="text-ash-300 text-xs"
							>From<input
								type="datetime-local"
								bind:value={form.available_from}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
						<label class="text-ash-300 text-xs"
							>To<input
								type="datetime-local"
								bind:value={form.available_to}
								class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
							/></label
						>
					</div>
					<div>
						<p class="text-ash-300 mb-1.5 text-xs">Recurring days (UTC)</p>
						<div class="flex flex-wrap gap-1">
							{#each DAYS as d}
								<button
									type="button"
									onclick={() => toggleDay(d.v)}
									class="rounded-lg px-2.5 py-1 text-[11px] transition-colors {form.cfg.recur_days.includes(d.v)
										? 'bg-teal-600 text-white'
										: 'bg-ash-700 text-ash-300 hover:bg-ash-600'}">{d.l}</button
								>
							{/each}
						</div>
						<div class="mt-2 grid grid-cols-2 gap-3">
							<label class="text-ash-300 text-xs"
								>From (HH:MM)<input
									bind:value={form.cfg.recur_from}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
									placeholder="18:00"
								/></label
							>
							<label class="text-ash-300 text-xs"
								>To (HH:MM)<input
									bind:value={form.cfg.recur_to}
									class="bg-ash-700 border-ash-600 text-ash-100 mt-1 w-full rounded-lg border px-3 py-2 text-sm"
									placeholder="21:00"
								/></label
							>
						</div>
					</div>
				</div>

				<!-- Enabled toggle -->
				<div class="border-ash-700 bg-ash-900/40 rounded-xl border p-4">
					<ConfigToggleRow
						label="Enabled"
						description="Disabled items stay hidden from the shop."
						labelIconClass="fas fa-power-off text-teal-400"
						bind:enabled={form.enabled}
					/>
				</div>

				{#if isTargeted}<p class="text-ash-500 text-[11px]">
						<i class="fas fa-crosshairs mr-1"></i>This is a targeted PvP item — members pick a target when using it.
					</p>{/if}
			</div>

			<!-- Footer -->
			<div class="border-ash-700 flex gap-3 border-t px-4 py-4 sm:px-6">
				<button onclick={() => (editing = null)} class="bg-ash-700 hover:bg-ash-600 text-ash-100 flex-1 rounded-lg py-2.5 text-sm font-medium transition-colors"
					>Cancel</button
				>
				<button
					onclick={save}
					disabled={saving}
					class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-teal-500 disabled:opacity-50"
				>
					{#if saving}<i class="fas fa-spinner fa-spin"></i>{/if}{saving ? 'Saving...' : 'Save'}
				</button>
			</div>
		</div>
	</div>
{/if}

<ConfirmModal
	open={confirmDelete !== null}
	title="Delete item"
	message={confirmDelete ? `Delete "${confirmDelete.name}"? This removes it from every server's shop.` : ''}
	confirmLabel="Delete"
	dangerous
	loading={deleting}
	onconfirm={remove}
	oncancel={() => (confirmDelete = null)}
/>
